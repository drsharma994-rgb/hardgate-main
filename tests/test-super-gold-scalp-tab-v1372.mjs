import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');
function createHarness(overrides = {}) {
  const now = Date.parse('2026-10-15T14:30:00Z');
  const RealDate = Date;
  function FixedDate(...args){
    return args.length ? new RealDate(...args) : new RealDate(now);
  }
  FixedDate.prototype = RealDate.prototype;
  FixedDate.now = function(){ return now; };
  FixedDate.parse = RealDate.parse;
  FixedDate.UTC = RealDate.UTC;
  const baseRows15 = Array.from({ length: 30 }, (_, i) => {
    const t = Math.floor((now - (30 - i) * 900_000) / 1000);
    if (i < 15) return { t, o: 2649.5, h: 2651.2, l: 2648.8, c: 2650.1, v: 4200 };
    if (i === 18) return { t, o: 2645.0, h: 2647.0, l: 2642.2, c: 2646.5, v: 2600 };
    if (i === 24) return { t, o: 2649.8, h: 2650.0, l: 2648.0, c: 2648.2, v: 1500 };
    if (i === 25) return { t, o: 2648.2, h: 2655.5, l: 2648.1, c: 2655.0, v: 3500 };
    if (i === 28) return { t, o: 2653.5, h: 2655.0, l: 2649.0, c: 2654.6, v: 2900 };
    return { t, o: 2650.0, h: 2653.5, l: 2649.2, c: 2652.8, v: 1800 };
  });
  const baseRows5 = Array.from({ length: 30 }, (_, i) => {
    const t = Math.floor((now - (30 - i) * 300_000) / 1000);
    if (i === 24) return { t, o: 2649.6, h: 2650.2, l: 2649.1, c: 2650.0, v: 950 };
    if (i === 25) return { t, o: 2650.0, h: 2652.6, l: 2649.9, c: 2652.4, v: 2100 };
    if (i === 26) return { t, o: 2652.2, h: 2653.2, l: 2651.0, c: 2652.9, v: 1500 };
    const base = 2645.0 + i * 0.28;
    return { t, o: +(base - 0.2).toFixed(2), h: +(base + 0.5).toFixed(2), l: +(base - 0.4).toFixed(2), c: +base.toFixed(2), v: 900 };
  });
  const win = {
    Date: FixedDate, Math, Number, String, Array, Object, Promise, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {},
    HG_tabs: [], HG_warmups: [],
    hgCfIntel: {
      fiveTf: () => ({ aligned: 'BULL', bull: 5, bear: 0, why: '5/5 BULL', rows: [{ tf: '5m', dir: 'BULL' }, { tf: '15m', dir: 'BULL' }, { tf: '1h', dir: 'BULL' }, { tf: '4h', dir: 'BULL' }, { tf: '1d', dir: 'BULL' }] }),
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
      armed: [{ strategy: '5m FVG Reload Watch', level: 2650.6, dir: 'long' }],
      cands: [
        { id: 'scalp-judas-1', sym: 'XAUUSD', dir: 'long', grade: 'B', entry: 2650.5, stop: 2645.0, t1: 2661.8, rr: 2.05, mark: 2651.2, killzone: 'NY_OPEN', barT: Math.floor(now / 1000), rows15m: baseRows15, rows5m: baseRows5, strategy: 'Judas Sweep Long' },
        { id: 'scalp-sb-2', sym: 'XAUUSD', dir: 'long', grade: 'B', entry: 2650.8, stop: 2646.0, t1: 2660.0, rr: 1.92, mark: 2651.2, killzone: 'NY_OPEN', barT: Math.floor(now / 1000), rows15m: baseRows15, rows5m: baseRows5, strategy: 'Silver Bullet FVG Pullback' }
      ]
    }),
    goldswingScan: () => ({ at: now, cands: [{ id: 'swing-1', sym: 'XAUUSD', dir: 'long', grade: 'A', entry: 2650.5, stop: 2640.0, t1: 2678.0, t2: 2692.0, rr: 2.6, mark: 2651.2, killzone: 'NY_OPEN', barT: Math.floor(now / 1000), strategy: 'GS1 4H Cascade' }] }),
    ...overrides
  };
  win.window = win;
  win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(code, win);
  return { win, baseRows15, baseRows5, now };
}
const { win, baseRows15, baseRows5 } = await (async () => createHarness())();
win.getGoldCandles = async (tf) => ({ rows: tf === '5m' ? baseRows5 : baseRows15 });
await win.superGoldRunScan({ force: true });
console.log('installed', win.__sgGoldScalpEnhancerInstalled);
const gsSnap = win.goldscalpScan();
console.log('version', gsSnap.hgUpgradedVersion, 'n', gsSnap.cands.length);
const judas = gsSnap.cands.find(c => c.id === 'scalp-judas-1');
const se = judas && judas.scalpEnhancement;
const sb = judas && judas.scalpPrecision;
console.log('grade', judas && judas.grade, 'entry', judas && judas.entry, 'stop', judas && judas.stop, 't1', judas && judas.t1);
console.log('tier', se && se.scalpTier, 'score', se && se.scalpScore, 'gates', se && se.gatesPassed, 'spread', se && se.spreadToRiskPct, 'net', se && se.netExpectedValueR);
console.log('reason', sb && sb.entryReason);
console.log('w', sb && sb.entryTranches && sb.entryTranches.map(t => t.weightPct), 'shield', sb && sb.psychShielded, 'front', sb && sb.t1FrontRun, 't1s', sb && sb.t1, 'stopS', sb && sb.stop);
if (se && se.gates) se.gates.forEach(g => console.log(g.passed ? 'Y' : 'N', g.id, g.detail));
const intel = win.superGoldScan().intel;
const micro5 = win.sgDetectMicrostructureZones(baseRows5, 'long');
console.log('fvg5', micro5.nearestFvg, 'abs', micro5.absorptionDetected, 'wick', micro5.wickRejectionScore);
const micro15 = win.sgDetectMicrostructureZones(baseRows15, 'long');
console.log('fvg15', micro15.nearestFvg && micro15.nearestFvg.ce, 'abs15', micro15.absorptionDetected, 'wick15', micro15.wickRejectionScore, 'sweep', micro15.sweepReclaimed);
const synth = win.sgSynthesizeGoldScalpSetups(intel, { balance: 10000, riskPct: 1 }, win);
assert.equal(win.__sgGoldScalpEnhancerInstalled, true);
assert.equal(gsSnap.hgUpgradedVersion, 'hg-v1373');
assert.equal(gsSnap.oneGoUpgraded, true);
assert.equal(gsSnap.cands.length, 2);
assert.equal(judas.grade, 'A');
assert.equal(judas.entry, 2650.5);
assert.equal(judas.stop, 2645);
assert.equal(se.scalpTier, 'SCALP A+ SNIPER');
assert.ok(se.scalpScore >= 88);
assert.ok(judas.scalpSizing && judas.scalpSizing.positionUnitsOz > 0);
assert.equal(judas.entry, 2650.5);
const sbCand = gsSnap.cands.find(c => c.id === 'scalp-sb-2');
const arch1 = win.sgDetectGoldScalpArchetypes(judas, intel, win);
const arch2 = win.sgDetectGoldScalpArchetypes(sbCand, intel, win);
assert.equal(arch1.archetype, 'NY_JUDAS_LIQUIDITY_SWEEP');
assert.equal(arch2.archetype, 'SILVER_BULLET_FVG_RELOAD');
assert.equal(arch2.isSilverBulletWindow, true);
assert.equal(arch2.emaRibbonAligned5, true);
assert.equal(arch2.emaRibbonAligned15, true);
assert.ok(sb.entryReason.includes('5m FVG CE'));
assert.equal(sb.entryTranches[0].weightPct, 70);
assert.equal(sb.entryTranches[1].weightPct, 30);
assert.equal(sb.psychShielded, true);
assert.equal(sb.t1FrontRun, true);
assert.equal(sb.t1, 2661.65);
assert.equal(sb.ratchetLadder.length, 4);
assert.equal(sb.ratchetLadder[1].code, 'SCALP_MFE_0_60R_TRIM');
assert.equal(se.gatesTotal, 10);
assert.ok(se.gatesPassed >= 9);
assert.ok(se.spreadToRiskPct <= 18);
assert.ok(se.netExpectedValueR > 1);
assert.equal(se.timeStopMin, 45);
assert.ok(synth.length >= 1);
assert.equal(synth[0].synthesized, true);
assert.ok(synth[0].scalpEnhancement && synth[0].scalpEnhancement.ok);
console.log('ALL hg-v1372 GOLD SCALP TAB TESTS PASSED');

