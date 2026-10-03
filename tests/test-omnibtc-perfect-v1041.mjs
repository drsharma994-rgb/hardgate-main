/* HARDGATE — hg-v1041: OMNIBTC READS ALL SEVEN PERFECT EVIDENCE LEGS.

   The shared PERFECT predicate (hg-perfect-setup.js) consumes seven evidence
   legs — taker flow, perp funding, volatility regime, structure trend, news
   calendar, session volume and the RVOL volume witness. OMNIBTC fed only
   three (flow, funding, news) and left the other four permanently UNREAD on
   data the desk already held: the winner's own 4h tape.

   This pack reads the remaining four (ATR percentile regime, EMA50/200
   structure trend, fire-bar RVOL → session + volume witness) and prints the
   PERFECT CRITERIA LEDGER beside the pick so every leg the predicate consumed
   is visible with its measured value and verdict.

   Harness: the test-omnibtc.mjs route — classic scripts in a vm context, the
   REAL scan driven end to end with the engine, venue, report and ledger
   stubs. What is stubbed is said; the desk logic between them is shipped.

   Run: node tests/test-omnibtc-perfect-v1041.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function mk(){
  return { innerHTML: '', textContent: '', disabled: false, style: {},
           classList: { add(){}, remove(){}, contains: () => false },
           addEventListener(){}, setAttribute(){}, appendChild(){},
           querySelector: () => null, querySelectorAll: () => [] };
}
function boot(extra){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array,
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => mk(), getElementById: () => null,
                   querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} },
                   documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-perfect-setup.js', 'hg-setup-core.js',
                   'plans.js', 'setup-ui.js', 'omnibtc-engines.js', 'omnibtc.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});   /* stubs land AFTER load — they win */
  return ctx;
}

const T4 = 14400, N4 = 220, LAST_T = 1760000000;
/* The crafted 4h tape: rising closes (EMA50 > EMA200 → structure 'up'), the
   trailing 100 ATRs split 50x wide / 49x narrow so the last ATR (mid width)
   ranks ~50th → HEALTHY, and a controllable fire-bar volume. */
function tape(rangeOf, volOf){
  const rows = [];
  for (let i = 0; i < N4; i++){
    const c = 100 + i * 0.05, r = rangeOf(i);
    rows.push({ t: LAST_T - (N4 - 1 - i) * T4, o: c - 0.02, h: c + r / 2, l: c - r / 2, c, v: volOf(i) });
  }
  return rows;
}
function midRange(i){ return i < 155 ? 1.0 : (i < 205 ? 3.0 : 1.75); }
const R4 = tape(midRange, i => (i < 219 ? 100 : 300));
const R4_THIN = tape(midRange, i => (i < 219 ? 100 : 30));
const R1 = tape(() => 1.0, () => 100).slice(0, 180).map(function(r, i){ return Object.assign({}, r, { t: LAST_T - (179 - i) * 3600 }); });
const R15 = R1.map(function(r, i){ return Object.assign({}, r, { t: LAST_T - (179 - i) * 900 }); });
const R1D = tape(() => 1.0, () => 100).map(function(r, i){ return Object.assign({}, r, { t: LAST_T - (259 - i) * 86400 }); });
const PLAN = { dir: 'long', entry: 100, stop: 90, t1: 120, t2: 135, clean: true, passed: 7, total: 7 };
const TSERIES = (function(){ const s = []; for (let k = 119; k >= 0; k--) s.push({ buySellRatio: 1.2, t: LAST_T - k * T4 }); return s; })();

function stubs(cap, fundingPct, rows4h){
  return {
    xuUniverse: async () => [{ sym: 'BTCUSD', base: 'BTC', exchange: 'delta', fundingPct: fundingPct, mark: 105 }],
    xuCandles: async (item, tf) => (tf === '4h' ? rows4h : tf === '1h' ? R1 : tf === '15m' ? R15 : R1D),
    binanceTakerRatio: async (sym, period, limit) => { cap.tkArgs = [sym, period, limit]; return { latest: TSERIES[TSERIES.length - 1], series: TSERIES }; },
    hgContractReportRun: (inp) => { cap.taker = inp && inp.takerSeries; return { sym: 'BTCUSD', sections: [], indicators: [], plan: { ok: false } }; },
    hgFwdRecordScan: (tab, tf, rows, opts) => { cap.rec = { tab, tf, rows, opts }; return 1; },
    hgFwdPanelHTML: (tab) => 'FWD:' + tab,
    hgPickMostProbableAny: (rows) => ({ row: rows[0], tier: rows[0] && rows[0].clean ? 'clean' : 'near' })
  };
}

console.log('== all seven legs readable-and-WITH crowns PERFECT⁺ and prints the ledger ==');
{
  const cap = {};
  const W = boot(Object.assign({ swingTryClean: () => Object.assign({}, PLAN) }, stubs(cap, -0.002, R4)));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  const stat = await W.hgObtcRunScan(ui);
  ok(/MOST PROBABLE/.test(stat), 'the scan crowns: ' + stat);
  const rec = cap.rec && cap.rec.rows && cap.rec.rows[0];
  ok(rec && rec.perfect === true, 'the crown reads PERFECT — the always-computable bar passed and nothing readable runs against');
  ok(rec.perfectPlus === true, 'and PERFECT⁺ — every readable evidence leg is explicitly WITH (funding -0.002, ATR mid, structure up, RVOL 3.0)');
  const d = ui.detail.innerHTML;
  ok(d.indexOf('PERFECT CRITERIA LEDGER') >= 0, 'the criteria ledger prints beside the pick');
  ok(d.indexOf('PERFECT⁺') >= 0, 'the headline tier is named');
  ok(d.indexOf('Structure trend') >= 0 && /Structure trend<\/span><span class="v ok">WITH/.test(d),
     'the structure leg shows its verdict: EMA50 above EMA200 = WITH for the long');
  ok(d.indexOf('RVOL 3.00') >= 0, 'the volume witness shows its measured value');
  ok(/Volatility regime<\/span><span class="v ok">WITH/.test(d), 'the volatility regime leg reads WITH (mid ATR percentile)');
  ok(/Perp funding<\/span><span class="v ok">WITH/.test(d), 'the funding leg reads WITH (long collects at -0.002)');
}

console.log('== a crowded funding leg disqualifies — the ledger stays silent ==');
{
  const cap = {};
  const W = boot(Object.assign({ swingTryClean: () => Object.assign({}, PLAN) }, stubs(cap, 0.06, R4)));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  const stat = await W.hgObtcRunScan(ui);
  ok(/MOST PROBABLE/.test(stat), 'the scan still crowns: ' + stat);
  const rec = cap.rec && cap.rec.rows && cap.rec.rows[0];
  ok(rec && rec.perfect === undefined, 'positive funding on a long is CROWDED AGAINST — the crown is not PERFECT');
  ok(ui.detail.innerHTML.indexOf('PERFECT CRITERIA LEDGER') < 0, 'no ledger for a non-perfect crown');
}

console.log('== a dead-tape fire bar disqualifies through the NEW volume legs ==');
{
  const cap = {};
  const W = boot(Object.assign({ swingTryClean: () => Object.assign({}, PLAN) }, stubs(cap, -0.002, R4_THIN)));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  const stat = await W.hgObtcRunScan(ui);
  ok(/MOST PROBABLE/.test(stat), 'the scan crowns: ' + stat);
  const rec = cap.rec && cap.rec.rows && cap.rec.rows[0];
  ok(rec && rec.perfect === undefined,
     'RVOL 0.30 is a THIN tape — the session + volume legs read AGAINST and the crown is not PERFECT');
  ok(ui.detail.innerHTML.indexOf('PERFECT CRITERIA LEDGER') < 0, 'no ledger on a thin tape');
}

console.log('== wiring pins — the shipped file actually reads and prints them ==');
{
  const src = read('omnibtc.js');
  ok(src.indexOf('function hgObtcFireRvol') >= 0, 'the RVOL reader is defined');
  ok(src.indexOf('function hgObtcStructureTrend') >= 0, 'the structure-trend reader is defined');
  ok(src.indexOf('function hgObtcPerfectLedgerHtml') >= 0, 'the criteria ledger is defined');
  ok(src.indexOf('pfReads.atrRegime') >= 0 && src.indexOf('pfReads.structureTrend') >= 0 && src.indexOf('pfReads.sess') >= 0,
     'all four new legs ride the reads bag the predicate consumes');
  ok(src.indexOf('perfectReads = pfReads') >= 0, 'the ledger reads the same bag the predicate consumed');
  ok(src.indexOf('hgObtcPerfectLedgerHtml(pick)') >= 0, 'the ledger is painted in the detail pass');
}

console.log('\ntest-omnibtc-perfect-v1041: ' + passed + ' passed, 0 failed');
