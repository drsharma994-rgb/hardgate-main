import assert from 'node:assert/strict';
import { hgProfitPhysics } from '../lib/hg-profit-physics.mjs';

const swingOk = hgProfitPhysics({
  scanner: 'swing', dir: 'long', entry: 100, stop: 97, t1: 106
});
assert.equal(swingOk.ok, true, swingOk.vetoes.join('; '));
assert.ok(swingOk.rr >= 2);

const thin = hgProfitPhysics({
  scanner: 'swing', dir: 'long', entry: 100, stop: 98, t1: 101.2
});
assert.equal(thin.ok, false);
assert.ok(thin.vetoes.some((v) => v.includes('R:R') || v.includes('noise')));

const wrongStop = hgProfitPhysics({
  scanner: 'edge', dir: 'long', entry: 100, stop: 101, t1: 104
});
assert.equal(wrongStop.ok, false);

const scalp = hgProfitPhysics({
  scanner: 'scalp', dir: 'short', entry: 100, stop: 100.8, t1: 98.4
});
assert.equal(scalp.ok, true, scalp.vetoes.join('; '));

const context = hgProfitPhysics({ scanner: 'regime', dir: '', entry: null });
assert.equal(context.ok, true);

const crowded = hgProfitPhysics({
  scanner: 'best', dir: 'long', entry: 100, stop: 97, t1: 106, funding: 0.08
});
assert.equal(crowded.ok, false);
assert.ok(crowded.vetoes.some((v) => v.includes('funding')));

console.log('profit-physics ok', { swing: swingOk.rr, scalp: scalp.label });
