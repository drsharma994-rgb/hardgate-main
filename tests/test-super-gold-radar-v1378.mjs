/* Prior-day benchmark and the distance to the entry. A single session is
   not called yesterday. A fill chance is not invented. The 60/40 split stays. */
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

const y = Date.UTC(2026, 9, 14, 12, 0, 0) / 1000;
const t = Date.UTC(2026, 9, 15, 12, 0, 0) / 1000;
const rows = [
  { t: y, o: 2650, h: 2660, l: 2640, c: 2652 },
  { t: t, o: 2650, h: 2654, l: 2638, c: 2648 },
  { t: t + 900, o: 2648, h: 2652, l: 2646, c: 2651 }
];
const bench = win.sgDailyBenchmarkLevels({ dir: 'long', mark: 2651 }, { rows15: rows });
assert.equal(bench.ok, true);
assert.equal(bench.pdh, 2660);
assert.equal(bench.pdl, 2640);
assert.equal(bench.pdm, 2650);
assert.equal(bench.benchmarkState, 'PDL_SWEEP_RECLAIM');
assert.equal(bench.amdPhase, 'MANIPULATION_JUDAS_RAID');

const oneDay = win.sgDailyBenchmarkLevels({ dir: 'long' }, {
  rows15: [
    { t: t, o: 2650, h: 2660, l: 2640, c: 2655 },
    { t: t + 900, o: 2655, h: 2658, l: 2652, c: 2656 }
  ]
});
assert.equal(oneDay.ok, false);
assert.equal(oneDay.amdPhase, 'UNREAD');
assert.equal(oneDay.pdh, null);

const wick = [];
for (let i = 0; i < 8; i++) wick.push({ o: 2650, h: 2652, l: 2648, c: 2651 });
wick[7] = { o: 2652, h: 2656, l: 2646, c: 2655 };
const micro = win.sgDetectMicrostructureZones(wick, 'long');
assert.equal(micro.absorptionDetected, true);
assert.ok(micro.clvScore > 0);
assert.ok(micro.wickRejectionScore >= 50);

const radar = win.sgSetupExecutionRadar(
  { dir: 'long', mark: 2652, entry: 2650 },
  { entry: 2650, atr: 4, unread: false, entryTranches: [{ weightPct: 60 }, { weightPct: 40 }] },
  { rows15: rows },
  { status: 'SAFE_LIMIT' },
  bench
);
assert.equal(radar.distToEntryPts, 2);
assert.equal(radar.distToEntryAtr, 0.5);
assert.equal(radar.fillProbabilityPct, 85);
assert.equal(radar.splitWeights, '60/40');

const unread = win.sgSetupExecutionRadar(
  { dir: 'long', mark: 2652, entry: 2650 },
  { entry: 2650, unread: true },
  { rows15: [] },
  {},
  {}
);
assert.equal(unread.distToEntryAtr, null);
assert.equal(unread.fillProbabilityPct, null);
console.log('BENCHMARK AND RADAR PASSED', bench.summary, radar.actionDirective);
