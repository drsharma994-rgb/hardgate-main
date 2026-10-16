/* Formation layer: archetype, fusion, and the armed watchlist.
   The path is tests/ so the desk file is the parent. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');
function createHarness(overrides = {}) {
  const now = Date.now();
  const baseRows15 = Array.from({ length: 40 }, (_, i) => ({
    t: Math.floor((now - (40 - i) * 900_000) / 1000),
    o: 2640 + i * 0.5, h: 2642 + i * 0.5, l: 2639 + i * 0.5, c: 2641 + i * 0.5, v: 1000 + i * 25
  }));
  const win = {
    Date, Math, Number, String, Array, Object, Promise, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {},
    HG_tabs: [], HG_warmups: [],
    hgCfIntel: {
      fiveTf: () => ({ aligned: 'BULL', bull: 4, bear: 1, why: '4/5 BULL', rows: [{ tf: '15m', dir: 'BULL' }] }),
      volRegime: () => ({ ok: true, regime: 'NORMAL', label: 'NORMAL (ATR 4.0)', atrNow: 4.0 }),
      forecastCone: () => ({ ok: true, why: '3-bar cone', steps: [{ bar: 1, low: 2648, high: 2660 }] }),
      structure: () => ({ ok: true, items: [{ label: '15m OB', px: 2650.0 }, { label: '4H Supply Wall', px: 2669.0 }] }),
      feedQuality: () => ({ ok: true, lock: false, why: '3 feeds within $1.20' }),
      sessionOverlay: () => ({ ok: true, label: 'LONDON-NY OVERLAP', why: 'peak liquidity' }),
      news: () => ({ ok: true, blackout: false, state: 'CLEAR', why: 'no high-impact print' })
    },
    goldCandleForecast: () => ({ dir: 'BULL', patterns: ['Bullish Engulfing'], close: 2660.5 }),
    goldspotState: () => ({ spot: 2660.2, xm: 2660.0, paxg: 2659.6 }),
    getGoldMacroCached: () => ({ realRateHint: 'TAILWIND' }),
    goldscalpScan: () => ({
      at: now,
      armed: [{ strategy: 'Judas Sweep Watch', level: 2658.5, dir: 'long' }],
      cands: [{
        id: 'scalp-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650.5, stop: 2640.0, t1: 2669.2, rr: 1.8,
        mark: 2659.8, killzone: 'NY_OPEN',
        barT: Math.floor((now - 1800_000) / 1000),
        strategy: 'Judas Sweep Long'
      }]
    }),
    goldswingScan: () => ({
      at: now,
      armed: [{ strategy: '4H Coil Breakout Watch', level: 2662.5, dir: 'long' }],
      cands: [{
        id: 'swing-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650.5, stop: 2640.0, t1: 2678.0, t2: 2692.0, rr: 2.6,
        mark: 2659.8, killzone: 'NY_OPEN',
        barT: Math.floor((now - 1800_000) / 1000),
        strategy: 'GS1 4H Cascade'
      }]
    }),
    ...overrides
  };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(code, win);
  return { win, baseRows15, now };
}
async function runTests() {
  const { win, baseRows15 } = createHarness();
  win.getGoldCandles = async () => ({ rows: baseRows15 });
  await win.superGoldRunScan({ force: true });
  const snap = win.superGoldScan();
  const crowned = win.sgCrownedRow(snap);
  assert.ok(crowned, 'Should crown top fused candidate');
  const top = crowned.row;
  assert.equal(top.fusedConviction, true, 'Aligned Scalp + Swing should fuse into a Fused Conviction candidate');
  assert.ok(top.formation, 'Candidate should carry enriched .formation metadata');
  assert.equal(top.formation.archetype, 'JUDAS_SWEEP_RECLAIM', 'Judas Sweep strategy should classify as JUDAS_SWEEP_RECLAIM');
  assert.ok(top.formation.qualityScore >= 90, 'Expected ELITE qualityScore >= 90, got ' + top.formation.qualityScore);
  assert.equal(top.formation.qualityBand, 'ELITE');
  assert.ok(top.formation.confluenceTags.includes('SCALP+SWING FUSED'), 'Confluence tags should include SCALP+SWING FUSED');
  assert.ok(top.formation.triggerCondition.includes('Limit buy in zone'), 'Should include explicit trigger condition');
  assert.ok(top.formation.scalePlan.includes('50% @ TP1'), 'Should include 50/30/20 scale plan');
  assert.equal(top.entry, 2650.5, 'fusion does not replace the desk entry');
  assert.equal(top.stop, 2640, 'fusion does not replace the desk stop');
  console.log('PASS 1');
  const aOte = win.sgClassifySetupArchetype({ strategy: 'GS1 OTE Order Block Pullback', dir: 'long' }, top.precision, snap.intel);
  assert.equal(aOte.code, 'OTE_ORDER_BLOCK_RELOAD');
  const aCoil = win.sgClassifySetupArchetype({ strategy: '15m Compression Coil Breakout', dir: 'long' }, top.precision, snap.intel);
  assert.equal(aCoil.code, 'COMPRESSION_COIL_BREAKOUT');
  const aVwap = win.sgClassifySetupArchetype({ strategy: 'Intraday Trend Hold', dir: 'long' }, { ok: true, entry: top.precision.vwap, vwap: top.precision.vwap, atr: 4.0 }, snap.intel);
  assert.equal(aVwap.code, 'VWAP_STRUCTURE_CONFLUENCE');
  console.log('PASS 2');
  assert.ok(Array.isArray(snap.armed) && snap.armed.length === 2, 'Should have 2 enriched forming setups');
  const arm0 = snap.armed[0];
  assert.equal(arm0.side, 'long');
  assert.equal(arm0.distPts, 2.0, '2660.5 close vs 2658.5 forming level = 2.0 pts');
  assert.equal(arm0.distAtr, 0.5, '2.0 pts / 4.0 ATR = 0.5 ATR');
  assert.ok(arm0.readinessPct >= 75, 'Setup 0.5 ATR away should be >= 75% ready');
  assert.ok(arm0.projectedStop < arm0.level && arm0.projectedT1 > arm0.level, 'Should project valid SL and TP1');
  console.log('PASS 3');
  console.log('ALL FORMATION TESTS PASSED');
}
runTests().catch(err => { console.error(err); process.exit(1); });
