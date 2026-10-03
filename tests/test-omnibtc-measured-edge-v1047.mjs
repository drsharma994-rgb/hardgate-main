/* HARDGATE — hg-v1047: OMNIBTC MEASURED-EDGE TIER + EXIT POLICY.

   The desk now runs the SHARED proven-edge gate on its own crown: the
   pick's mechanic is judged against the OMNIBTC forward pool at the desk
   evidence floor (hgDeskParam minEvidence, default 20) by hgFwdJudgeSample.

     below the floor  -> EDGE UNPROVEN chip, "n/floor settled" — accumulating
                         mode: nothing is blocked, the crown still trades
     armed + expR > 0 -> EDGE PROVEN chip, ticket stands
     armed + expR <=0 -> EDGE LOSING chip + WATCH ONLY note; the crown is
                         demoted to a watch (tier near -> ticket:false) and
                         the record carries measuredState:'losing'

   The record keeps writing either way (the anti-deadlock invariant), and a
   ticket now prints the EXIT POLICY panel: scale 50% at T1, trail the stop
   to breakeven, ride the rest (the book's measured auto-rule).

   Run: node tests/test-omnibtc-measured-edge-v1047.mjs */
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
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = []; ctx.HG_TAB_MODS = {};
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => mk(), getElementById: () => null,
                   querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} },
                   documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-gates.js', 'hg-perfect-setup.js', 'hg-setup-core.js',
                   'crypto-position-risk.js', 'cryptogates.js', 'plans.js', 'setup-ui.js',
                   'hg-forward.js', 'proven-edge.js', 'omnibtc-engines.js', 'omnibtc.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});   /* stubs land AFTER load — they win */
  return ctx;
}

const T4 = 14400, N4 = 220, LAST_T = 1760000000;
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
const R1 = tape(() => 1.0, () => 100).slice(0, 180).map(function(r, i){ return Object.assign({}, r, { t: LAST_T - (179 - i) * 3600 }); });
const R15 = R1.map(function(r, i){ return Object.assign({}, r, { t: LAST_T - (179 - i) * 900 }); });
const R1D = tape(() => 1.0, () => 100).map(function(r, i){ return Object.assign({}, r, { t: LAST_T - (259 - i) * 86400 }); });
const PLAN = { dir: 'long', entry: 100, stop: 90, t1: 120, t2: 135, clean: true, passed: 7, total: 7 };
const TSERIES = (function(){ const s = []; for (let k = 119; k >= 0; k--) s.push({ buySellRatio: 1.2, t: LAST_T - k * T4 }); return s; })();

function stubs(cap, poolStats){
  return {
    xuUniverse: async () => [{ sym: 'BTCUSD', base: 'BTC', exchange: 'delta', fundingPct: -0.002, mark: 105 }],
    xuCandles: async (item, tf) => (tf === '4h' ? R4 : tf === '1h' ? R1 : tf === '15m' ? R15 : R1D),
    binanceTakerRatio: async () => ({ latest: TSERIES[TSERIES.length - 1], series: TSERIES }),
    binanceFunding: async () => ({ fundingPct: 0.004, markPrice: 105, nextFundingTime: 0 }),
    hgContractReportRun: () => ({ sym: 'BTCUSD', sections: [], indicators: [], plan: { ok: false } }),
    hgFwdRecordScan: (tab, tf, rows, opts) => { cap.rec = { tab, tf, rows, opts }; return 1; },
    hgFwdPanelHTML: (tab) => 'FWD:' + tab,
    hgPickMostProbableAny: (rows) => ({ row: rows[0], tier: rows[0] && rows[0].clean ? 'clean' : 'near' }),
    swingTryClean: () => Object.assign({}, PLAN),
    /* the REAL judge (hgFwdJudgeSample) runs against this controlled pool */
    hgFwdStats: (tab, mech) => { cap.statsArgs = [tab, mech]; return poolStats; }
  };
}
async function scanOnce(poolStats){
  const cap = {};
  const W = boot(stubs(cap, poolStats));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  const stat = await W.hgObtcRunScan(ui);
  return { cap, W, ui, stat };
}

console.log('== below the floor: accumulating mode — the crown still trades, the chip says so ==');
{
  const { cap, ui, stat } = await scanOnce({ samples: 12, hit: 60, expR: 0.5 });
  ok(/MOST PROBABLE/.test(stat), 'the scan crowns: ' + stat);
  /* the mechanic name is the same expression the forward record writes
     (omniKind first), so the gate and the record always agree on the pool */
  ok(cap.statsArgs && cap.statsArgs[0] === 'OMNIBTC' && /SWING/.test(cap.statsArgs[1]),
     'the gate reads the OMNIBTC pool for this mechanic: ' + cap.statsArgs.join(' / '));
  const d = ui.detail.innerHTML;
  ok(d.indexOf('MEASURED EDGE') >= 0, 'the measured-edge panel prints');
  ok(d.indexOf('EDGE UNPROVEN') >= 0 && d.indexOf('12/20 settled') >= 0, 'the chip reports progress against the floor (12/20)');
  ok(d.indexOf('WATCH ONLY') < 0, 'accumulating mode blocks nothing — no watch-only note');
  ok(d.indexOf('EXIT POLICY') >= 0, 'a ticket prints the exit policy');
  const rec = cap.rec && cap.rec.rows && cap.rec.rows[0];
  ok(rec && rec.ticket === true, 'the record still reads ticket:true below the floor');
  ok(rec && rec.measuredState === undefined, 'the measured mark is recorded only once armed');
}

console.log('== armed and profitable: EDGE PROVEN — the ticket stands ==');
{
  const { cap, ui } = await scanOnce({ samples: 60, hit: 55, expR: 0.4 });
  const d = ui.detail.innerHTML;
  ok(d.indexOf('EDGE PROVEN') >= 0 && d.indexOf('n=60') >= 0, 'the chip shows the proven record');
  ok(d.indexOf('EXIT POLICY') >= 0, 'the ticket keeps its exit policy');
  const rec = cap.rec && cap.rec.rows && cap.rec.rows[0];
  ok(rec && rec.ticket === true && rec.measuredState === 'proven', 'the record reads ticket:true with measuredState proven');
}

console.log('== armed and losing: the desk stands aside — watch, not a ticket ==');
{
  const { cap, ui, stat } = await scanOnce({ samples: 60, hit: 30, expR: -0.35 });
  ok(/MOST PROBABLE/.test(stat), 'the crown still prints: ' + stat);
  const d = ui.detail.innerHTML;
  ok(d.indexOf('EDGE LOSING') >= 0 && d.indexOf('n=60') >= 0, 'the chip names the losing record');
  ok(d.indexOf('WATCH ONLY') >= 0, 'the blocked note explains the stand-aside');
  ok(d.indexOf('EXIT POLICY') < 0, 'a watch gets no exit policy');
  const rec = cap.rec && cap.rec.rows && cap.rec.rows[0];
  ok(rec && rec.ticket === false, 'the record reads ticket:false — the crown is not a ticket');
  ok(rec && rec.measuredState === 'losing', 'the losing verdict rides the record');
}

console.log('== wiring pins ==');
{
  const src = read('omnibtc.js');
  ok(src.indexOf("gfn('hgProvenEdgeVerdict')") >= 0, 'the shared proven-edge gate is consulted');
  ok(src.indexOf('measuredStandAside') >= 0, 'the stand-aside stamp exists');
  ok(src.indexOf('function hgObtcAutoRuleHtml') >= 0, 'the exit-policy panel is defined');
  ok(src.indexOf('measuredState') >= 0, 'the measured mark rides the record');
  const html = read('index.html');
  ok(html.indexOf('proven-edge.js') < html.indexOf('omnibtc.js'), 'proven-edge loads before omnibtc in the shell');
}

console.log('\ntest-omnibtc-measured-edge-v1047: ' + passed + ' passed, 0 failed');
