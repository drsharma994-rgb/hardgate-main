/* Fractal cascade, inverse gap, and the breakeven hurdle. A missing print
   stays unread. The desk entry is not moved. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');
const win = {
  Date, Math, Number, String, Array, Object, Promise, setTimeout, clearTimeout,
  setInterval: () => 1, clearInterval: () => {},
  HG_tabs: [], HG_warmups: []
};
win.window = win; win.globalThis = win;
vm.createContext(win);
vm.runInContext(code, win);

const asian = [];
for (let i = 0; i < 6; i++){
  asian.push({ t: Date.UTC(2026, 9, 15, 1, i * 15, 0) / 1000, o: 2650, h: 2654, l: 2648, c: 2651, v: 100 });
}
asian.push({ t: Date.UTC(2026, 9, 15, 8, 0, 0) / 1000, o: 2651, h: 2652, l: 2644, c: 2650, v: 100 });
asian.push({ t: Date.UTC(2026, 9, 15, 8, 15, 0) / 1000, o: 2650, h: 2656, l: 2649, c: 2655, v: 400 });
const cas = win.sgMultiTfFractalCascade({ dir: 'long' }, {
  fiveTf: { rows: [
    { tf: '4h', dir: 'BULL' }, { tf: '1h', dir: 'BULL' },
    { tf: '15m', dir: 'BULL' }, { tf: '5m', dir: 'BULL' }, { tf: '1d', dir: 'BEAR' }
  ]},
  rows15: asian
});
assert.equal(cas.alignedCount, 4);
assert.equal(cas.totalTf, 5);
assert.equal(cas.cascadeState, 'FULL_FRACTAL_CASCADE');
assert.equal(cas.sessionRaid, 'ASIAN_IB_LOW_SWEEP_RECLAIM');
assert.equal(cas.ibRaided, true);
assert.equal(cas.ibLow, 2648);

const empty = win.sgMultiTfFractalCascade({ dir: 'long' }, {});
assert.equal(empty.alignedCount, 0);
assert.equal(empty.sessionRaid, 'UNREAD');
assert.notEqual(empty.alignedCount, 4);

const gap = [];
for (let i = 0; i < 8; i++) gap.push({ o: 2650, h: 2652, l: 2648, c: 2651, v: 100 });
gap[2] = { o: 2660, h: 2662, l: 2659, c: 2660, v: 100 };
gap[3] = { o: 2658, h: 2659, l: 2654, c: 2655, v: 100 };
gap[4] = { o: 2654, h: 2656, l: 2653, c: 2654, v: 100 };
gap[6] = { o: 2656, h: 2664, l: 2655, c: 2663, v: 100 };
gap[7] = { o: 2662, h: 2665, l: 2660, c: 2664, v: 500 };
const micro = win.sgDetectMicrostructureZones(gap, 'long');
assert.equal(micro.ok, true);
assert.ok(micro.nearestIfvg, 'a bearish gap closed back through is an inverse gap');
assert.ok(micro.nearestIfvg.ce > 0);
assert.equal(micro.volCommitmentRatio > 1, true);

const unreadRisk = win.sgSetupRiskProfile({}, { unread: true });
assert.equal(unreadRisk.ok, false);
assert.equal(unreadRisk.breakevenWinPct, null);
assert.notEqual(unreadRisk.summary && unreadRisk.summary.indexOf('62'), 0);

const risk = win.sgSetupRiskProfile({ ok: true, estWinPct: 74, rewardR: 2.35, halfKellyRiskPct: 1.5 }, { ok: true, unread: false, blendedRr: 2.35 });
assert.equal(risk.ok, true);
assert.equal(risk.breakevenWinPct, 29.9);
assert.equal(risk.edgeMarginPct, 44.1);
assert.equal(risk.ruinGrade, 'FORTRESS');
assert.ok(risk.streak5DdPct > 0 && risk.streak5DdPct < 10);
console.log('CASCADE AND HURDLE PASSED', cas.summary, risk.summary);
