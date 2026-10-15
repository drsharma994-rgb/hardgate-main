import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../super-gold.js', import.meta.url), 'utf8');
const win = {
  Date, Math, Number, String, Array, Object, Promise, setTimeout, clearTimeout,
  setInterval: () => 1, clearInterval: () => {},
  HG_tabs: [], HG_warmups: []
};
win.window = win;
win.globalThis = win;
vm.createContext(win);
vm.runInContext(code, win);

const named = win.sgDetectGoldScalpArchetypes({ dir: 'long', strategy: 'Judas Sweep Long', entry: 2650.5, stop: 2640 }, {}, win);
assert.equal(named.archetype, 'NY_JUDAS_LIQUIDITY_SWEEP');

const kept = win.sgRefineGoldScalpBracket({ dir: 'long', strategy: 'Judas Sweep Long', entry: 2650.5, stop: 2640, t1: 2670 }, {}, win);
assert.equal(kept.unread, true);
assert.equal(kept.entry, 2650.5);
assert.equal(kept.stop, 2640);

const row = { id: 'scalp-1', dir: 'long', strategy: 'Judas Sweep Long', grade: 'A', entry: 2650.5, stop: 2640, t1: 2670, mark: 2651 };
const intel = { volRegime: { ok: true, regime: 'NORMAL', atrNow: 4 }, structure: { ok: true, items: [{ label: '15m OB', px: 2650 }] } };
const enhanced = win.sgEnhanceGoldScalpSetup(Object.assign({}, row), intel, win, {});
assert.equal(enhanced.entry, 2650.5);
assert.equal(enhanced.stop, 2640);
assert.equal(enhanced.t1, 2670);
assert.ok(enhanced.scalpEnhancement);
assert.equal(enhanced.scalpEnhancement.deskUntouched, true);
assert.equal(enhanced.scalpEnhancement.spreadUsd, null);

const calls = { n: 0 };
win.goldscalpScan = () => { calls.n++; return { at: Date.now(), cands: [Object.assign({}, row)] }; };
win.sgInstallGoldScalpTabEnhancer(win);
const snap = win.goldscalpScan();
assert.equal(calls.n, 1);
assert.equal(snap.cands[0].entry, 2650.5);
assert.equal(snap.cands[0].stop, 2640);
assert.ok(snap.scalpSummary);
assert.equal(win.sgSynthesizeGoldScalpSetups({}, {}, win).length, 0);
console.log('SCALP TAB PASSED', named.archetypeLabel, enhanced.scalpEnhancement.scalpTier);
