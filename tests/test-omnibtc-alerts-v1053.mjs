/* HARDGATE — hg-v1053: THE OMNIBTC CROWN REACHES THE TELEGRAM BATCH.

   The desk's crown never joined the unified crypto alert batch — the desk
   could print the best setup on the terminal and no phone would ever see
   it. Now:

   - W.hgObtcSnap() exposes the last crown in a light shape (levels, tier,
     PERFECT badges, the measured verdict, the refinement stamp, scan time).
   - tabalerts' collectOmnibtc pushes the crown as a clean7 row FIRST in the
     batch (the most selective read), ticket-tier only — a measured-edge
     stand-aside (tier near) never alerts.
   - the crypto convicted-only filter now admits the desk's own gate-clean
     crown.
   - the background cycle (scheduleTabAutoScan mustScan + HG_TAB_AUTO_SCAN)
     scans the desk even when the tab is closed, so records accumulate and
     alerts fire.

   Run: node tests/test-omnibtc-alerts-v1053.mjs */
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
                   'crypto-position-risk.js', 'formation.js', 'plans.js', 'setup-ui.js',
                   'hg-forward.js', 'proven-edge.js', 'omnibtc-engines.js', 'omnibtc.js', 'tabalerts.js'])
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
    hgApplyExactEntry: (p) => Object.assign({}, p),
    hgFwdStats: (tab, mech) => poolStats
  };
}
async function scanOnce(poolStats){
  const cap = {};
  const W = boot(stubs(cap, poolStats));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  const stat = await W.hgObtcRunScan(ui);
  return { cap, W, ui, stat };
}

console.log('== a PERFECT+ crown joins the batch as a clean7 row ==');
{
  const { W } = await scanOnce({ samples: 12, hit: 0.6, expR: 0.5 });
  const snap = W.hgObtcSnap();
  ok(snap && snap.tier === 'clean' && isFinite(snap.at), 'the alert seam exposes the crown with its scan time');
  ok(snap.pick.row.perfectPlus === true, 'the PERFECT+ badge rides the seam');
  const list = [];
  W.collectOmnibtc(list);
  ok(list.length === 1, 'the collector pushed exactly one row');
  const o = list[0];
  ok(o.src === 'OMNIBTC' && o.sym === 'BTCUSD' && o.dir === 'long', 'the row names the desk, the contract and the direction');
  ok(o.clean7 === true && o.tier === 'PERFECT+', 'the crown rides as a gate-clean PERFECT+ tier');
  ok(isFinite(o.entry) && isFinite(o.stop) && isFinite(o.t1), 'the row carries ENTRY / STOP / T1 for the Telegram line');
  ok(/STAR PERFECT\+/.test(o.note || ''), 'the note carries the badge');
}

console.log('== a measured stand-aside never alerts ==');
{
  const { W } = await scanOnce({ samples: 60, hit: 0.3, expR: -0.35 });
  const snap = W.hgObtcSnap();
  ok(snap && snap.tier === 'near' && snap.measured && snap.measured.state === 'losing',
     'the seam exposes the stand-aside (near + losing)');
  const list = [];
  W.collectOmnibtc(list);
  ok(list.length === 0, 'a demoted crown never reaches the batch');
}

console.log('== wiring pins ==');
{
  const tsrc = read('tabalerts.js');
  ok(tsrc.indexOf('function collectOmnibtc') >= 0, 'the collector is defined');
  ok(tsrc.indexOf("collectOmnibtc(out);") >= 0, 'the collector runs first in the batch');
  ok(tsrc.indexOf("if (s.src === 'OMNIBTC') return true;") >= 0, 'the convicted-only filter admits the crown');
  const osrc = read('omnibtc.js');
  ok(osrc.indexOf('W.hgObtcSnap') >= 0 && osrc.indexOf('at: Date.now()') >= 0, 'the alert seam + scan time are wired');
  const html = read('index.html');
  /* hg-v1068 added trendmx to the same line - the pin reads the pair */
  ok(html.indexOf("|| t === 'omnibtc'") >= 0 && html.indexOf("|| t === 'trendmx')") >= 0, 'the background cycle force-scans both crowns');
  ok(html.indexOf("'omnibtc': async function(opts){") >= 0, 'the headless auto-scan entry exists');
}

console.log('\ntest-omnibtc-alerts-v1053: ' + passed + ' passed, 0 failed');
