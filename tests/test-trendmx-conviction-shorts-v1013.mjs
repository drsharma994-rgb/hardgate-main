/* HARDGATE — hg-v1013: THE SHORT SIDE'S CONVICTION (direction parity).

   trendmxConviction measured the composite's strength on the long side
   only — sc >= 4 STRONG, sc >= 2 CONVICTION — while every other reader of
   the composite is direction-agnostic: tmDirOf (|score| >= 2), the
   FORMING predicate (|score|), the board rank (|score|), the summary's
   strong counts (+4/−4). A row at −5, the maximum bearish alignment the
   composite can print, had less standing than a row at +2. The practical
   effect: no short ever reached the LIMIT BOARD or the promoted slice
   (SMC + taker flow) except through a 7/7 clean, and the CONVICTION
   filter never showed a short. The fix takes |score| — the SAME bars (4
   and TM_MAJORITY), both directions. Not a recalibration: the numbers
   never moved; they stopped pointing one way. The golden desk stays
   long-only by design — it enforces dir === 'long' before conviction is
   ever asked, and a golden cross IS a bull cross.

   Harness: classic scripts in a vm context (the v1012 route).

   Run: node tests/test-trendmx-conviction-shorts-v1013.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const text = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const FILES = ['indicators.js', 'indicators2.js', 'hg-setup-core.js', 'desk-scan-universe.js', 'omniroute.js', 'trendtable.js'];
function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  vm.createContext(ctx);
  for (const f of FILES)
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

const T0 = 1750000000;
function tape(n, tfSec, start, step){
  const rows = []; let c = start;
  for (let i = 0; i < n; i++){
    const o = c; c = c + step;
    rows.push({ t: T0 - (n - 1 - i) * tfSec, o, h: Math.max(o, c) + Math.abs(step) * 0.5,
                l: Math.min(o, c) - Math.abs(step) * 0.5, c, v: 1000 });
  }
  return rows;
}
function taker(ratio, n){
  const s = [];
  for (let k = n - 1; k >= 0; k--) s.push({ buySellRatio: ratio, t: T0 - k * 14400 });
  return { latest: s[s.length - 1], series: s };
}
const UP1 = tape(260, 86400, 100, 1), UP4 = tape(120, 14400, 100, 0.6);
const DN1 = tape(260, 86400, 400, -1), DN4 = tape(120, 14400, 400, -0.6);
const BUY = taker(1.25, 120);   /* +3.33 — net aggressive buying (probed in v1012) */

const W = boot();
const TS_UP = W.trendScore(UP1, UP4), TS_DN = W.trendScore(DN1, DN4);
ok(TS_UP.score === 5 && TS_DN.score === -5, 'fixtures score ±5 (probed)');

function mkShort(sym, opts){
  return Object.assign({
    sym: sym, base: sym.replace(/USDT$/, ''), exchange: 'binance',
    score: TS_DN.score, comps: TS_DN.comps, freshCross: TS_DN.freshCross, adx: TS_DN.adx,
    price: DN1[DN1.length - 1].c, rows4h: DN4, rows1h: DN4.slice(-60),
    fundingPct: 0.01,
    gate: { gatesPassed: 5, gatesTotal: 7, clean7: false, nearClean: false, hit: null, label: '5/7', veto: null }
  }, opts || {});
}

console.log('== conviction is the strength of the majority, not its side ==');
{
  const c5 = W.trendmxConviction({ score: -5 });
  ok(c5 && c5.tier === 'STRONG' && c5.prime === true, 'score -5 -> STRONG CONVICTION, prime');
  const c2 = W.trendmxConviction({ score: -2 });
  ok(c2 && c2.tier === 'CONVICTION' && c2.prime === false, 'score -2 -> CONVICTION (tmDirOf’s own bar)');
  ok(W.trendmxConviction({ score: -1 }) === null, 'score -1 -> no conviction (|score| < 2 both ways)');
  ok(W.trendmxConviction({ score: 0 }) === null, 'score 0 -> null');
  ok(W.trendmxConviction({}) === null && W.trendmxConviction(null) === null, 'no score / no row -> null, never throws');
  /* regression: the long side reads exactly as before — the bars never moved */
  const u5 = W.trendmxConviction({ score: 5 }), u2 = W.trendmxConviction({ score: 2 });
  ok(u5 && u5.tier === 'STRONG' && u2 && u2.tier === 'CONVICTION', 'long side unchanged: +5 STRONG, +2 CONVICTION');
}

console.log('== the board admits a conviction short (no clean7 needed) ==');
{
  const w = boot();
  const row = mkShort('SHTUSDT');
  ok(W.tmDirOf(row) === 'short', 'the row’s own majority is short');
  const plan = w.trendmxPlan(Object.assign({}, row, { dir: 'short' }));
  ok(plan && plan.dir === 'short' && plan.stop > plan.entry && plan.t1 < plan.entry,
     'a valid short plan exists (stop above, T1 below — mirrored geometry)');
  let rec = null;
  w.hgFwdRecordScan = (tab, tf, list, opts) => { rec = { tab, tf, list, opts }; return list.length; };
  const html = w.trendmxLimitBoardHTML([row]);
  ok(text(html).indexOf('SHTUSDT') >= 0 && text(html).indexOf('SHORT') >= 0, 'a 5/7 conviction short paints on the LIMIT BOARD');
  ok(rec && rec.list.length === 1 && rec.list[0].dir === 'short', 'and records as a short');
  ok(rec.list[0].mechanic === 'TM-CONVICTION' && rec.list[0].ticket === false, 'mechanic string + ticket semantics unchanged');
}

console.log('== the promoted slice (SMC + taker flow) covers conviction shorts ==');
{
  const w = boot();
  let calls = 0;
  w.binanceTakerRatio = async () => { calls++; return BUY; };   /* net buying AGAINST a short */
  const row = mkShort('SHTUSDT');
  const res = await w.trendmxFlowScan([row]);
  ok(res.scanned === 1 && calls === 1, 'a conviction short without clean7 is flow-judged now (pre-fix: never fetched)');
  ok(row.flow && row.flow.verdict === 'against', 'net buying against the short stamps AGAINST');
  const plan = w.trendmxPlan(Object.assign({}, row, { dir: 'short' }));
  ok(w.trendmxRowTier(row, plan) === 'near', 'flow-against caps the short at NEAR (v1012 leadership, both directions)');
  let rec = null;
  w.hgFwdRecordScan = (tab, tf, list) => { rec = { list }; return list.length; };
  const html = w.trendmxLimitBoardHTML([row]);
  ok((rec === null) && text(html).indexOf('held off') >= 0, 'and the short is held off the board, named, unrecorded');
}

console.log('== the golden desk stays long-only by design ==');
{
  const w = boot();
  const death = mkShort('DTHUSDT', { freshCross: 'DEATH' });
  const golden = w.trendmxGoldenCrossSetups([death]);
  ok(golden.length === 0, 'a fresh DEATH cross with max bear conviction yields no golden setup (a golden cross IS a bull cross)');
  const long = { sym: 'GLDUSDT', score: 5, comps: TS_UP.comps, freshCross: 'GOLDEN',
                 adx: TS_UP.adx, price: UP1[UP1.length - 1].c, rows4h: UP4, rows1h: null,
                 gate: { veto: null } };
  ok(w.trendmxGoldenCrossSetups([long]).length === 1, 'the golden long still surfaces exactly as before');
}

console.log('== the matrix’s own counts already agreed — the reader was the outlier ==');
{
  /* tmDirOf / FORMING / rank / summary were always |score|; pin the parity
     claim: a -5 row and a +5 row take the same tier path with the same gate */
  const w = boot();
  const s = mkShort('SHTUSDT'), l = mkShort('LNGUSDT', { score: 5, comps: TS_UP.comps, price: UP1[UP1.length - 1].c, rows4h: UP4, rows1h: UP4.slice(-60) });
  const ps = w.trendmxPlan(Object.assign({}, s, { dir: 'short' }));
  const pl = w.trendmxPlan(Object.assign({}, l, { dir: 'long' }));
  ok(w.trendmxRowTier(s, ps) === w.trendmxRowTier(l, pl), 'tier parity: same gate, same |score|, same tier');
  const line = w.trendmxSummaryLine([s, l], []);
  ok(line.indexOf('strong +1/−1') >= 0, 'summary counts the strong pair symmetrically');
}

console.log('\nPASS — ' + passed + ' assertions');
