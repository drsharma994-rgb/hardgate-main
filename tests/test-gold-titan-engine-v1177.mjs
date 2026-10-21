/* HARDGATE — hg-v1177: GOLD TITAN v7.0 — the additive quantitative layer.

   The genuinely-new institutional mechanics on top of GoldCoreEngine v2.5:
   Pearson correlation + flight-to-safety, 20-day ADR exhaustion, NYMO true
   day, Gann Square of 9, time-price symmetry, footprint absorption, DSET
   double-sweep, 0.618/0.705/0.786 OTE, CE 50%, resting liquidity pools,
   dealing range and the 1% lot sizer. Every function is pure and tested
   here; the telemetry panel is evidence-only.

   Run: node tests/test-gold-titan-engine-v1177.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extra){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setInterval, clearInterval, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  vm.createContext(ctx);
  vm.runInContext(read('gold-titan-engine.js'), ctx, { filename: 'gold-titan-engine.js' });
  if (ctx.hgGoldTitanStop) ctx.hgGoldTitanStop();
  Object.assign(ctx, extra || {});
  return ctx;
}
const k = (o,h,l,c,v,t) => ({ open:o, high:h, low:l, close:c, volume:v, time:t });

console.log('== Pearson correlation + flight-to-safety ==');
{
  const W = boot({});
  const gold = Array.from({length:40}, (_,i)=>k(0,1,0,2600+i,1,0));
  const dxyRise = Array.from({length:40}, (_,i)=>k(0,1,0,100+i,1,0));     // both up -> r ~ +1
  const dxyFall = Array.from({length:40}, (_,i)=>k(0,1,0,140-i,1,0));     // gold up, dxy down -> r ~ -1
  const pos = W.hgGoldTitanPearson(gold, dxyRise, 30);
  ok(pos.r > 0.9 && pos.flightToSafety === true, 'both rising reads strongly positive + flight-to-safety');
  const neg = W.hgGoldTitanPearson(gold, dxyFall, 30);
  ok(neg.r < -0.9 && neg.regime === 'STANDARD_INVERSE', 'gold up / dxy down reads strongly negative');
  ok(W.hgGoldTitanPearson(gold, [], 30).r === null, 'missing dxy series is an honest null');
}

console.log('== 20-day ADR exhaustion ==');
{
  const W = boot({});
  const daily = Array.from({length:22}, (_,i)=>k(0,50,0,50,1,i));   // 21 ranges of $50
  const a = W.hgGoldTitanAdr(daily, 50, 20);
  ok(a.adrDollars === 50 && a.pctUsed === 100 && a.exhausted === true, 'a full-range today reads 100% used and exhausted');
  const daily2 = daily.slice(0, -1).concat([k(0,20,0,50,1,21)]);      // today range $20 -> 40%
  const a2 = W.hgGoldTitanAdr(daily2, 50, 20);
  ok(a2.pctUsed === 40 && a2.exhausted === false && a2.remainingDollars === 30, 'a partial-range today leaves $30 room');
}

console.log('== NYMO true-day open ==');
{
  const W = boot({});
  const day = [ k(2611,10,0,2610,1, Date.UTC(2026,0,5,0,0)/1000), k(2613,10,0,2612,1, Date.UTC(2026,0,5,4,0)/1000) ];
  ok(W.hgGoldTitanNymo(day).nymo === 2613, 'prefers the 04:00 UTC bar over the 00:00 bar');
  ok(W.hgGoldTitanNymo([]) === null, 'no bars -> null');
}

console.log('== Gann Square of 9 ==');
{
  const W = boot({});
  const g = W.hgGoldTitanGann(2600);
  ok(g.levels.length === 4, 'four angles');
  const root = Math.sqrt(2600);
  const exact = Math.pow(root + (180/180), 2);
  ok(Math.abs(g.levels[1].harmonicUp - exact) < 0.01, 'the 180deg harmonic matches sqrt(price)+1 squared');
  ok(g.closestLevel != null && g.closestDegree != null, 'closest level and degree are named');
}

console.log('== time-price symmetry, footprint, DSET, OTE, CE, lots ==');
{
  const W = boot({});
  ok(W.hgGoldTitanSymmetry([k(0,1,0,2600,1,0)], 0, 2600).inSymmetry === false, 'zero distance is not symmetric');
  const sym = W.hgGoldTitanSymmetry(Array.from({length:12}, (_,i)=>k(0,1,0,2600+i,1,i)), 0, 2600);
  ok(sym.ratio != null, 'a positive-bars positive-dollars move returns a ratio');
  const absB = W.hgGoldTitanFootprint(k(9, 10, 2, 9.5, 1, 0), 'BULL');   // o9 c9.5 hi10 lo2 -> lower wick 7 / range 8
  ok(absB.absorbed === true, 'a long lower wick reads absorbed');
  const dset = W.hgGoldTitanDset([k(0,10,1,9,1,0), k(0,10,1,9,1,1), k(0,10,2,9,1,2), k(0,10,3,9,1,3), k(0,10,4,9,1,4), k(0,10,5,9,1,5), k(0,10,6,9,1,6), k(0,10,7,9,1,7)], 4, 'BULL');
  ok(dset.confirmedStage2 === true && dset.sweepCount >= 2, 'two sub-level lows confirm stage 2');
  const ote = W.hgGoldTitanOte(100, 90);
  ok(Math.abs(ote.ret0705 - 92.95) < 0.01, '0.705 retracement of a 10 range');
  ok(W.hgGoldTitanCe(100, 90).ce50 === 95, 'CE 50% is the mid of the FVG');
  const lots = W.hgGoldTitanLots(10000, 0.01, 100, 99.5);
  ok(Math.abs(lots.riskDollars - 100) < 0.01 && Math.abs(lots.lots - 2) < 0.01, '1% of $10k over a $0.50 stop = 2 lots ($100 risk)');
}

console.log('== resting liquidity pools + dealing range ==');
{
  const W = boot({});
  const tape = Array.from({length:25}, (_,i)=>k(0, 20 + (i===12 ? 5 : 0), 0, 20, 1, i));
  tape[12] = k(0, 25, 18, 21, 1, 12);
  const pools = W.hgGoldTitanPools(tape);
  ok(pools.length >= 1 && pools.some(p=>p.type==='BUY_SIDE_LIQUIDITY'), 'a lone swing high maps as buy-side liquidity');
  const deal = W.hgGoldTitanDealingRange(Array.from({length:20}, (_,i)=>k(0, i+10, 0, i+10, 1, i)), 15);
  ok(deal.zone !== 'EQUILIBRIUM' && deal.percentile != null, 'a price inside a known range reads a percentile');
}

console.log('== wiring pins ==');
{
  const src = read('gold-titan-engine.js');
  ['pearsonCorrelation','adrExhaustion','nymoTrueDayOpen','gannSquare9','timePriceSymmetry','footprintAbsorption','doubleSweepExhaustion','oteGoldenPocket','consequentEncroachment','restingLiquidityPools','dealingRange','dynamicLots'].forEach(n => {
    ok(src.indexOf(n) >= 0, n + ' is defined');
  });
  ok(src.indexOf('HG_GoldTitanEngine') >= 0 && src.indexOf('hgGoldTitanStrip') >= 0, 'the engine and the telemetry strip are exported');
  ok(src.indexOf('HG_tabs.') < 0, 'the incompatible tab-registration objects are NOT introduced (the real desks use HG_tabs.push)');
}

console.log('\ntest-gold-titan-engine-v1177: ' + passed + ' passed, 0 failed');
