import assert from 'node:assert/strict';
import { fingerprint, fpAtrBucket, fpSession, fpClass } from '../lib/setup-fingerprint.mjs';
import { buildEdgeTable, edgeGate, wilsonLB, edgeLeaderboard } from '../lib/edge-table.mjs';
import { formationQuality, fqsGate } from '../lib/formation-quality.mjs';
import { createGateRecorder, shadowResolve } from '../lib/gate-attrib.mjs';

let pass = 0;
const t = (name, fn) => { fn(); pass += 1; console.log('  ok  ' + name); };

console.log('setup-fingerprint');
t('classes + buckets', () => {
  assert.equal(fpClass('XAUUSD'), 'gold');
  assert.equal(fpClass('PEPEUSDT'), 'alt');
  assert.equal(fpAtrBucket(0.1), 'atr-dead');
  assert.equal(fpAtrBucket(5), 'atr-wild');
  assert.equal(fpAtrBucket(null), 'atr-na');
  assert.equal(fpSession(9), 'sess-london');
});
t('stable + low cardinality', () => {
  const c = { symbol: 'BTCUSDT', side: 'long', poiKind: 'fvg', regime: 'trend', htfAlign: true, confluence: 3, atrPct: 1.1, hour: 9, rr: 2.2 };
  assert.equal(fingerprint(c).key, fingerprint({ ...c }).key);
  assert.equal(fingerprint(c).key.split('|').length, 9);
});
t('empty input never throws', () => { assert.ok(fingerprint().key.length > 0); });

console.log('edge-table');
t('wilson bounds', () => {
  assert.equal(wilsonLB(0, 0), 0);
  assert.ok(wilsonLB(5, 10) < 0.5 && wilsonLB(5, 10) > 0.2);
  assert.ok(wilsonLB(50, 100) > wilsonLB(5, 10));
});
t('builds and shrinks', () => {
  const base = { symbol: 'BTCUSDT', side: 'long', poiKind: 'fvg', regime: 'trend', htfAlign: true, confluence: 3, atrPct: 1.1, hour: 9, rr: 2.2 };
  const rows = [];
  for (let i = 0; i < 20; i += 1) rows.push({ ...base, r: i % 3 === 0 ? 2 : -1, maeR: -0.5, mfeR: 2.5 });
  rows.push({ ...base, r: null });
  const tbl = buildEdgeTable(rows);
  assert.equal(tbl.global.n, 20);
  const row = tbl.lookup(base);
  assert.equal(row.source, 'exact');
  assert.ok(row.capture > 0 && row.capture < 1);
  assert.ok(Math.abs(row.expShrunk) <= Math.abs(row.expR) + 1e-9);
});
t('blocks negative families, explores unknowns', () => {
  const bad = { symbol: 'PEPEUSDT', side: 'long', poiKind: 'ema9', regime: 'chop', htfAlign: false, confluence: 1, atrPct: 4, hour: 2, rr: 1.2 };
  const rows = Array.from({ length: 30 }, () => ({ ...bad, r: -1 }));
  const tbl = buildEdgeTable(rows);
  const g = edgeGate(bad, tbl);
  assert.equal(g.ok, false);
  assert.match(g.reason, /edge-negative/);
  const unknown = edgeGate({ symbol: 'XAUUSD', side: 'short', poiKind: 'avwap-session' }, tbl);
  assert.equal(unknown.ok, true);
  assert.equal(unknown.mult, 1);
  assert.equal(edgeGate(bad, null).ok, true);
  assert.ok(edgeLeaderboard(tbl).worst.length >= 1);
});

console.log('formation-quality');
t('A setup beats F setup', () => {
  const good = formationQuality({ side: 'long', poiKind: 'sweep-reclaim', htfAlign: true, bos: true, adx: 26, sweptLiquidity: true, imbalance: true, confluence: 4, oiflowState: 'NEW LONGS', rvol: 1.8, atrPct: 1.2, hour: 13, rr: 3.2, stopDistAtr: 1.0, realRateHint: 'TAILWIND' });
  const bad = formationQuality({ side: 'long', poiKind: 'ema9', htfAlign: false, chochAgainst: true, adx: 11, confluence: 0, oiflowState: 'NEW SHORTS', rvol: 0.5, atrPct: 0.2, hour: 2, rr: 1.1, stopDistAtr: 0.2, realRateHint: 'HEADWIND' });
  assert.equal(good.grade, 'A');
  assert.ok(good.fqs >= 80, 'good fqs ' + good.fqs);
  assert.ok(bad.fqs <= 45, 'bad fqs ' + bad.fqs);
  assert.equal(bad.weakest.length > 0, true);
});
t('missing data scores neutral, not zero', () => {
  const q = formationQuality({ symbol: 'XAUUSD' });
  assert.ok(q.fqs > 30 && q.fqs < 60, 'neutral fqs ' + q.fqs);
});
t('event blackout caps score', () => {
  const q = formationQuality({ side: 'long', poiKind: 'sweep-reclaim', htfAlign: true, bos: true, adx: 30, sweptLiquidity: true, confluence: 4, rvol: 2, atrPct: 1.2, hour: 13, rr: 3, stopDistAtr: 1, eventBlackout: true });
  assert.ok(q.fqs <= 40);
  assert.ok(q.notes.includes('cap:event-blackout'));
});
t('floors differ by class', () => {
  const cand = { side: 'long', poiKind: 'ote', htfAlign: true, confluence: 2, atrPct: 1.2, hour: 13, rr: 2, stopDistAtr: 1 };
  const gold = fqsGate(cand, 'gold');
  const alt = fqsGate(cand, 'alt');
  assert.ok(gold.floor < alt.floor);
  assert.match(gold.reason, /fqs-(ok|low)/);
});

console.log('gate-attrib');
t('records + wraps', () => {
  const rec = createGateRecorder();
  rec.record('cooldown', false, { symbol: 'BTC', reason: 'x' });
  rec.record('cooldown', true, { symbol: 'ETH' });
  rec.record('fqs', false, { symbol: 'PEPE', fqs: 40 });
  const wrapped = rec.wrap('cluster', () => ({ ok: false, reason: 'heat' }));
  wrapped({ symbol: 'SOL' });
  const s = rec.summary();
  const cd = s.rows.find((r) => r.gate === 'cooldown');
  assert.equal(cd.vetoRate, 50);
  assert.equal(s.rows.find((r) => r.gate === 'cluster').veto, 1);
  assert.equal(s.events.length, 4);
  rec.reset();
  assert.equal(rec.summary().rows.length, 0);
});
t('shadow book flags over-filtering', () => {
  const rows = [
    { symbol: 'BTC', side: 'long', entry: 100, stop: 95, target: 115, vetoGate: 'fqs', ts: 1 },
    { symbol: 'ETH', side: 'long', entry: 100, stop: 95, target: 115, vetoGate: 'fqs', ts: 1 },
    { symbol: 'SOL', side: 'long', entry: 100, stop: 95, target: 115, vetoGate: 'cooldown', ts: 1 },
    { symbol: 'BAD', side: 'long', entry: 100, stop: null, target: 115, vetoGate: 'cooldown', ts: 1 },
  ];
  const out = shadowResolve(rows, (sym) => (sym === 'SOL' ? { high: 101, low: 94 } : { high: 120, low: 99 }));
  assert.equal(out.resolved, 3);
  assert.equal(out.rows.find((r) => r.gate === 'fqs').verdict, 'OVER-FILTERING');
  assert.equal(out.rows.find((r) => r.gate === 'cooldown').verdict, 'EARNING');
});
t('shadow handles junk input', () => {
  assert.equal(shadowResolve(null).resolved, 0);
  assert.equal(shadowResolve([{}], () => null).resolved, 0);
});

console.log(`\n${pass} tests passed`);
