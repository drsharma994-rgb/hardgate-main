/* HARDGATE — fix pack 13 regression guards (setup quality). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import {
  relBrier, relGateLift, relReliabilityCurve, relNoPredictedCount,
} from '../lib/reliability.mjs';
import { hgCostBps, hgCostVeto } from '../lib/cost-model.mjs';
import { hgRegimeAdjust, hgRegimeResolveState } from '../lib/regime-thresholds.mjs';
import { pbEffectiveBeta, pbRealizedBeta } from '../lib/clusters.mjs';
import { goldCotAssess, goldCotParse } from '../lib/gold-cot.mjs';
import { hgStandDownState } from '../lib/stand-down.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

function mkRecords(n){
  const out = [];
  for (let i = 0; i < n; i++){
    out.push({
      status: 'settled', sym: 'BTCUSDT', dir: i % 2 ? 'long' : 'short',
      entry: 100, stop: 98, t1: 104, rr1: 2,
      r: i % 3 === 0 ? 2 : -1,
      rNet: i % 3 === 0 ? 1.8 : -1.1,
      layers: ['TAPE', 'G6'],
      tier: i % 4 === 0 ? 'PRIME' : 'HIGH',
      at: Date.now() - i * 86400000,
      closedAt: Date.now() - i * 86400000,
    });
  }
  return out;
}

console.log('== reliability pure ==');
{
  ok(relBrier(mkRecords(10)) === null, 'relBrier returns null below n=20');
  const b = relBrier(mkRecords(25));
  ok(b && typeof b.brier === 'number', 'relBrier returns brier at n>=20');
  const lift = relGateLift(mkRecords(30));
  ok(lift.length > 0, 'relGateLift produces rows');
  const unproven = lift.every(r => r.nWith < 12 ? r.verdict === 'UNPROVEN' : true);
  ok(unproven, 'relGateLift marks UNPROVEN below nWith=12');
  if (lift.length >= 2){
    const a = lift[0].liftR == null ? -1e9 : lift[0].liftR;
    const b2 = lift[1].liftR == null ? -1e9 : lift[1].liftR;
    ok(a >= b2, 'relGateLift sorted by liftR desc');
  }
  ok(relReliabilityCurve(mkRecords(25), 5).length > 0, 'relReliabilityCurve bins');
  ok(relNoPredictedCount([{ status: 'settled', r: 1, entry: 1, stop: 0.9 }]) >= 1,
    'records without rr1 counted in noPredicted');
}

console.log('== reliability tab read-only ==');
{
  let setCalls = 0;
  const ls = {
    getItem(){ return null; },
    setItem(k){ if (k === 'hg_score_v1') setCalls++; },
  };
  const ctx = {
    console, Math, Date, isFinite, parseFloat, JSON, Array, Object, Number, String, Promise,
    localStorage: ls, HG_tabs: [],
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'scorecard.js'), 'utf8'), ctx, { filename: 'scorecard.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'fixpack13-core.js'), 'utf8'), ctx, { filename: 'fixpack13-core.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'reliability.js'), 'utf8'), ctx, { filename: 'reliability.js' });
  const tab = (ctx.HG_tabs || []).find(t => t && t.id === 'reliability');
  ok(tab && typeof tab.mount === 'function', 'RELIABILITY tab registered');
  const el = {
    innerHTML: '',
    querySelector(sel){
      if (sel === '#relBody') return { innerHTML: '' };
      if (sel === '#relStat') return { textContent: '' };
      return null;
    },
  };
  tab.mount(el);
  ok(setCalls === 0, 'reliability.js NEVER writes localStorage ledger key');
}

console.log('== cost model ==');
{
  const veto = hgCostVeto({ roundTripBps: 42, entry: 100, stop: 98 });
  ok(veto.veto === true, 'hgCostVeto trips at costFrac > 0.15');
  ok(/42 bps/.test(veto.reason) && /200 bps R/.test(veto.reason), 'hgCostVeto names numbers in reason');
  const deg = hgCostBps({ depthUsd: null, atrPct: 2, notionalUsd: 1000, venue: 'delta' });
  ok(deg.degraded === true, 'hgCostBps sets degraded:true when depthUsd is null');
}

console.log('== clusters + regime ==');
{
  const rb = pbRealizedBeta('SOL', Array.from({ length: 25 }, (_, i) => 100 + i * 0.1),
    Array.from({ length: 25 }, (_, i) => 50 + i * 0.2));
  ok(rb && rb.n >= 20, 'pbRealizedBeta with enough bars');
  const eff = pbEffectiveBeta('SOL', null, { beta: 1.1, n: 10 });
  ok(eff.source === 'assumed', 'pbEffectiveBeta falls back below 20 bars');
  const eff2 = pbEffectiveBeta('SOL', null, { beta: 1.1, n: 22 });
  ok(eff2.source === 'measured', 'pbEffectiveBeta uses measured at n>=20');
  const base = { minRR: 2, fundingZCap: 2.5, maxConcurrent: 4, vetoCounterTrend: false };
  const adj = hgRegimeAdjust(base, -4, 'crypto');
  ok(base.minRR === 2, 'hgRegimeAdjust does not mutate input');
  ok(Array.isArray(adj.applied) && adj.applied.length > 0, 'hgRegimeAdjust returns applied[]');
  const dark = hgRegimeResolveState(function(){ return null; });
  ok(dark.label === 'NEUTRAL' && dark.dark === true, 'regimeState null resolves to NEUTRAL, never RISK-ON');
}

console.log('== gold COT + stand down ==');
{
  const rows = [];
  for (let i = 0; i < 120; i++){
    rows.push({
      market_and_exchange_names: 'GOLD - COMMODITY EXCHANGE INC.',
      noncomm_positions_long_all: 200000 + i * 100,
      noncomm_positions_short_all: 100000,
      open_interest_all: 400000,
      report_date_as_yyyy_mm_dd: '2024-01-' + String((i % 28) + 1).padStart(2, '0'),
    });
  }
  const series = goldCotParse(rows);
  ok(series.length > 0, 'goldCotParse finds COMEX gold');
  const hi = series.slice();
  hi[0] = Object.assign({}, hi[0], { specNetPctOi: 0.99 });
  const crowded = goldCotAssess(hi);
  ok(crowded.crowding === 'SPEC CROWDED LONG', 'goldCotAssess flags crowding at 90th percentile');
  const now = Date.now();
  const recs2 = [
    { status: 'settled', r: 1, rNet: -1.1, closedAt: now - 1000 },
    { status: 'settled', r: 1, rNet: -1.05, closedAt: now - 2000 },
    { status: 'settled', r: 1, rNet: -1.02, closedAt: now - 3000 },
  ];
  ok(hgStandDownState(recs2, { maxConsecutiveLosses: 3, maxDailyLossR: -99, maxWeeklyLossR: -99 }).tripped === true,
    'hgStandDownState trips on 3 consecutive losses and prefers rNet');
  ok(hgStandDownState([{ status: 'settled', r: 2, rNet: -1.1, closedAt: now }], { maxConsecutiveLosses: 1, maxDailyLossR: -99, maxWeeklyLossR: -99 }).tripped === true,
    'hgStandDownState counts rNet loss even when gross r is positive');
}

console.log('== cache + proxy ==');
{
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  ok(/hg-v266/.test(sw), 'cache hg-v266');
  ok(sw.indexOf('fixpack13-core.js') >= 0 && sw.indexOf('reliability.js') >= 0,
    'sw precaches fixpack13-core.js and reliability.js');
  const proxy = fs.readFileSync(path.join(root, 'api/proxy.js'), 'utf8');
  ok(proxy.indexOf('publicreporting.cftc.gov') >= 0, 'proxy allows CFTC host');
}

console.log('\n' + pass + ' passed');
