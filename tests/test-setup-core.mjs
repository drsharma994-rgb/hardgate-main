/* HARDGATE — hg-setup-core pure module tests */
import {
  gateResult, getClosedCandles, alignBarsByTime, quantPrice, alertKey,
  postCostRr, calcTradeSizing, fundingGateDirectional, universeFilter, regimeOverlay
} from '../lib/hg-setup-core.mjs';

let n = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); n++; console.log('  ok —', m); };

console.log('== gateResult ==');
var g = gateResult('G1', 'test', 'na', 'missing', { degradeMode: 'veto' });
ok(g.state === 'veto', 'na degrades to veto by default');
g = gateResult('G1', 'test', 'na', 'missing', { degradeMode: 'pass' });
ok(g.pass === true, 'na can degrade to pass when declared');

console.log('== getClosedCandles ==');
var bars = [{ t: 1000, c: 1 }, { t: 4600, c: 2 }];
var closed = getClosedCandles(bars, '1h', 5000);
ok(closed.rows.length === 1, 'drops forming 1h bar');

console.log('== alignBarsByTime ==');
var pairs = alignBarsByTime([{ t: 100, h: 1 }], [{ t: 100, h: 2 }], 120);
ok(pairs.length === 1 && pairs[0].right.h === 2, 'aligns by timestamp');

console.log('== calcTradeSizing inverse ==');
var lin = calcTradeSizing({ balance: 10000, riskPct: 1, entry: 50000, stop: 49000, tpRR: 2, maxLeverage: 20 });
var inv = calcTradeSizing({ balance: 10000, riskPct: 1, entry: 50000, stop: 49000, tpRR: 2, maxLeverage: 20, inverse: true });
ok(inv.qty > lin.qty, 'inverse sizing larger than linear for BTC-like entry');

console.log('== fundingGateDirectional ==');
var fg = fundingGateDirectional(0.05, 'long', { degradeMode: 'veto' });
ok(fg.pass === false, 'crowded long funding vetoes long');

console.log('== postCostRr ==');
var pcr = postCostRr(100, 95, 110, { takerBps: 6, slipBps: 5, spreadBps: 8 });
ok(pcr && pcr.rr < pcr.grossRr, 'post-cost R:R below gross');

console.log('== universeFilter ==');
var uni = universeFilter([{ symbol: 'BTCUSDT', turnoverUsd: 1e8 }, { symbol: 'DEAD', turnoverUsd: 1 }], { minTurnoverUsd: 5e6 });
ok(uni.length === 1 && uni[0].symbol === 'BTCUSDT', 'filters illiquid symbols');

console.log('== regimeOverlay ==');
var ro = regimeOverlay(-4, 'long');
ok(ro.extraConfluence === 1, 'risk-off requires extra confluence for longs');

console.log('\nsetup-core: ' + n + ' passed');
