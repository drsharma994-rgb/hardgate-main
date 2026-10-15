/* Deep setup formation: unfilled 15m gaps and order blocks, a 60/40 limit,
   expectancy from the measured reward, and a missed-fill stand-aside. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');
function createHarness(overrides = {}) {
  const now = Date.now();
  const baseRows15 = Array.from({ length: 30 }, (_, i) => {
    const t = Math.floor((now - (30 - i) * 900_000) / 1000);
    if (i === 24) return { t, o: 2649.8, h: 2650.0, l: 2648.0, c: 2648.2, v: 1500 };
    if (i === 25) return { t, o: 2648.2, h: 2655.5, l: 2648.1, c: 2655.0, v: 3200 };
    if (i === 26) return { t, o: 2654.5, h: 2658.0, l: 2652.0, c: 2657.2, v: 2100 };
    return { t, o: 2640 + i * 0.6, h: 2642 + i * 0.6, l: 2639 + i * 0.6, c: 2641 + i * 0.6, v: 1000 + i * 20 };
  });
  const win = {
    Date, Math, Number, String, Array, Object, Promise, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {},
    HG_tabs: [], HG_warmups: [],
    hgCfIntel: {
      fiveTf: () => ({ aligned: 'BULL', bull: 4, bear: 1, why: '4/5 BULL', rows: [{ tf: '15m', dir: 'BULL' }] }),
      volRegime: () => ({ ok: true, regime: 'NORMAL', label: 'NORMAL (ATR 4.0)', atrNow: 4.0 }),
      forecastCone: () => ({ ok: true, why: '3-bar cone', steps: [{ bar: 1, low: 2650, high: 2665 }] }),
      structure: () => ({ ok: true, items: [{ label: '15m OB', px: 2650.0 }, { label: '4H Supply Wall', px: 2672.0 }] }),
      feedQuality: () => ({ ok: true, lock: false, why: '3 feeds within $1.20' }),
      sessionOverlay: () => ({ ok: true, label: 'LONDON-NY OVERLAP', why: 'peak liquidity' }),
      news: () => ({ ok: true, blackout: false, state: 'CLEAR', why: 'no high-impact print' })
    },
    goldCandleForecast: () => ({ dir: 'BULL', patterns: ['Bullish Engulfing'], close: 2657.4 }),
    goldspotState: () => ({ spot: 2657.5, xm: 2657.3, paxg: 2657.0 }),
    getGoldMacroCached: () => ({ realRateHint: 'TAILWIND' }),
    goldscalpScan: () => ({
      at: now,
      cands: [{
        id: 'scalp-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650.5, stop: 2640.0, t1: 2670.0, rr: 1.9,
        mark: 2657.4, killzone: 'NY_OPEN',
        barT: Math.floor((now - 900_000) / 1000),
        strategy: 'Judas Sweep Long'
      }]
    }),
    goldswingScan: () => ({
      at: now,
      cands: [{
        id: 'swing-1', sym: 'XAUUSD', dir: 'long', grade: 'A',
        entry: 2650.5, stop: 2640.0, t1: 2678.0, t2: 2692.0, rr: 2.6,
        mark: 2657.4, killzone: 'NY_OPEN',
        barT: Math.floor((now - 900_000) / 1000),
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
  const { win, baseRows15, now } = createHarness();
  win.getGoldCandles = async () => ({ rows: baseRows15 });
  await win.superGoldRunScan({ force: true });
  const snap = win.superGoldScan();
  const micro = win.sgDetectMicrostructureZones(baseRows15, null, 'long');
  assert.equal(micro.ok, true);
  assert.ok(micro.nearestFvg, 'Should detect unmitigated Bullish FVG');
  assert.equal(micro.nearestFvg.bottom, 2650.0);
  assert.equal(micro.nearestFvg.top, 2652.0);
  assert.equal(micro.nearestFvg.ce, 2651.0);
  assert.ok(micro.nearestOb, 'Should detect unmitigated Bullish Order Block');
  assert.equal(micro.nearestOb.mt, 2649.0);
  console.log('PASS 1');
  const crowned = win.sgCrownedRow(snap);
  assert.ok(crowned);
  const top = crowned.row;
  console.log('tranches', JSON.stringify(top.precision && top.precision.entryTranches), 'blend', top.precision && top.precision.blendedEntry, 'entry', top.precision && top.precision.entry);
  console.log('expectancy', JSON.stringify(top.expectancy));
  assert.equal(top.precision.entryTranches.length, 2);
  assert.equal(top.precision.entryTranches[0].weightPct, 60);
  assert.equal(top.precision.entryTranches[1].weightPct, 40);
  assert.ok(top.precision.blendedEntry < top.precision.entry, 'blend ' + top.precision.blendedEntry + ' entry ' + top.precision.entry);
  assert.ok(top.formation && top.formation.tranchePlan.includes('60% @'));
  assert.equal(typeof top.formation.timeDecay.ttlLeftMin, 'number');
  assert.ok(top.formation.expectancy.summary.includes('E[R]'));
  assert.ok(top.expectancy.estWinPct >= 60, 'win ' + top.expectancy.estWinPct);
  assert.ok(top.expectancy.expectedValueR >= 1.2, 'ev ' + top.expectancy.expectedValueR);
  assert.ok(top.expectancy.halfKellyRiskPct >= 0.25 && top.expectancy.halfKellyRiskPct <= 1.5, 'kelly ' + top.expectancy.halfKellyRiskPct);
  console.log('PASS 2');
  const decayFresh = win.sgEvaluateSetupDecay(top, top.precision, snap.intel);
  assert.equal(decayFresh.status, 'FRESH');
  assert.equal(decayFresh.missedBoat, false);
  const missedRow = { ...top, entry: 2630.0, t1: 2650.0, mark: 2649.0, barT: Math.floor((now - 1800_000) / 1000) };
  const decayMissed = win.sgEvaluateSetupDecay(missedRow, { ok: true, entry: 2630.0, t1: 2650.0 }, snap.intel);
  assert.equal(decayMissed.missedBoat, true);
  assert.equal(decayMissed.status, 'FRONT_RUN_INVALIDATED');
  console.log('PASS 3');
  const synthRows = win.sgSynthesizeTapeSetups(snap.intel, { balance: 10000, riskPct: 1 }, win);
  console.log('synth', synthRows.length, synthRows[0] && synthRows[0].entry, synthRows[0] && !!synthRows[0].formation, synthRows[0] && !!synthRows[0].expectancy);
  assert.equal(synthRows.length, 1);
  assert.equal(synthRows[0].synthesized, true);
  assert.ok(synthRows[0].formation && synthRows[0].expectancy);
  console.log('PASS 4');
  console.log('ALL DEEP FORMATION TESTS PASSED');
}
runTests().catch(err => { console.error(err); process.exit(1); });
