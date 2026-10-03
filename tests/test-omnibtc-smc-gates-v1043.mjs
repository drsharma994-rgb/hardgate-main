/* HARDGATE — hg-v1043: THE SMC WATCH'S 6/7 WAS A HARDCODED LABEL.

   watchRow() stamped `passed: 6, gatesTotal: 7` on every specialty-engine
   watch without EVER evaluating a gate. The card said "Do not trade it until
   all seven hard gates pass" about a tally no gate produced, and the
   hg-v1038 transparency banner had no measured gate to name.

   hg-v1043 wires the real shared 7-gate matrix (swingTryNear) behind the SMC
   watch: the honest tally + gateMeta + missing-gate list ride the row, G6 is
   re-priced on the SMC levels themselves, a signal against the matrix's own
   direction is named counter-cascade and stays a watch, and a genuine 7/7
   becomes a CLEAN candidate.

   Run: node tests/test-omnibtc-smc-gates-v1043.mjs */
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
    JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
                     addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, body: { appendChild(){} },
                   documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'hg-gates.js', 'hg-perfect-setup.js',
                   'hg-setup-core.js', 'crypto-position-risk.js', 'cryptogates.js',
                   'plans.js', 'setup-ui.js', 'omnibtc-engines.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});   /* stubs land AFTER load — they win */
  return ctx;
}

/* The rising tape: a clean long cascade — but monotonic closes pin RSI(14)
   near 100, so G3 (RSI > 70 on a long) genuinely vetoes. The real matrix
   must name that; the hardcoded 6/7 could never. */
const T4 = 14400, N4 = 220, LAST_T = 1760000000;
function risingTape(){
  const rows = [];
  for (let i = 0; i < N4; i++){
    const c = 100 + i * 0.05;
    rows.push({ t: LAST_T - (N4 - 1 - i) * T4, o: c - 0.02, h: c + 0.5, l: c - 0.5, c, v: 100 + (i % 7) });
  }
  return rows;
}
const R4 = risingTape();
const R1 = risingTape().slice(0, 180).map(function(r, i){ return Object.assign({}, r, { t: LAST_T - (179 - i) * 3600 }); });
const R15 = R1.map(function(r, i){ return Object.assign({}, r, { t: LAST_T - (179 - i) * 900 }); });
const TICKER = { symbol: 'BTCUSD', exchange: 'delta', fundingPct: 0.001, mark: 100 };

console.log('== a counter-cascade SMC short carries the REAL gate tally, named gates ==');
{
  const W = boot({
    pineSmcCore: () => ({ dir: 'short', entry: 100, stop: 103, t1: 94, t2: 90, rr: 2.0 }),
    hgObtcApplyOmniPrincipal: (r) => ({ pickable: true })
  });
  const out = W.hgObtcRunExtraEngines(R4, R1, R15, TICKER, {}).candidates || [];
  const row = out.filter(function(r){ return /SMC/.test(r.engine || ''); })[0];
  ok(row != null, 'the SMC engine produced a watch row');
  ok(Array.isArray(row.gateMeta) && row.gateMeta.length >= 7,
     'the real 7-gate matrix rode the row (' + (row.gateMeta ? row.gateMeta.length : 0) + ' meta entries) — no more invented tally');
  const realCount = row.gateMeta.filter(function(g){ return g.pass === true && g.id !== 'DIR'; }).length;
  ok(row.gatesPassed === Math.min(realCount, 6) && row.gatesPassed < 7 && row.gatesPassed !== 6,
     'the tally is the real count (' + row.gatesPassed + '/7), not the hardcoded 6');
  ok(Array.isArray(row.missing) && row.missing.indexOf('G3') < 0,
     'the long-side G3 verdict is NOT stamped on the counter-cascade short (it reads na)');
  ok(row.gateMeta.some(function(g){ return g.id === 'G3' && g.state === 'na' && /cascade side/.test(String(g.detail || '')); }),
     'G3 is marked unevaluated for the cascade side, with the reason named');
  ok(row.missing.indexOf('DIRECTION') >= 0,
     'the counter-cascade fact is named: the SMC short runs against a long-reading cascade');
  ok(row.gateMeta.some(function(g){ return g.id === 'DIR' && /p \d+ vs EMA200 \d+/.test(String(g.detail || '')); }),
     'the DIRECTION gate carries the cascade\'s measured read (p vs EMA200)');
  ok(row.gateMeta.some(function(g){ return g.id === 'DIR' && /counter-trend|against the 7-gate/.test(String(g.detail || '')); }),
     'the direction gate prints its measured reason');
  ok(row.clean === false, 'a counter-cascade signal never mints a ticket');
}

console.log('== the aligned case: a real 7/7 would become a CLEAN candidate ==');
{
  /* Same long cascade, but the SMC stub fires LONG with a 2.0R plan. G3 still
     genuinely vetoes on this tape, so this run pins that the badge follows
     the real gates — not the direction alone. */
  const W = boot({
    pineSmcCore: () => ({ dir: 'long', entry: 100, stop: 97, t1: 106, t2: 110.5, rr: 2.0 }),
    hgObtcApplyOmniPrincipal: (r) => ({ pickable: true })
  });
  const out = W.hgObtcRunExtraEngines(R4, R1, R15, TICKER, {}).candidates || [];
  const row = out.filter(function(r){ return /SMC/.test(r.engine || ''); })[0];
  ok(row != null, 'the aligned SMC row produced a watch');
  ok(row.missing && row.missing.indexOf('G3') >= 0,
     'G3 still vetoes (RSI pinned near 100) — the badge follows the gates, not the label');
  ok(row.missing.indexOf('DIRECTION') < 0, 'no counter-cascade flag when the directions agree');
  ok(row.clean === false, '6/7 real stays a watch');
}

console.log('== wiring pins ==');
{
  const src = read('omnibtc-engines.js');
  ok(src.indexOf('the 6/7 was a HARDCODED label') >= 0, 'the defect is documented at the fix site');
  ok(src.indexOf("gfn('swingGateMatrix')") >= 0, 'the real matrix is consulted');
  ok(src.indexOf("hgObtcTrySmc(rows4h, ticker)") >= 0, 'the ticker reaches the gate evaluation');
  ok(src.indexOf("missing.push('DIRECTION')") >= 0, 'the counter-cascade case names itself');
}

console.log('\ntest-omnibtc-smc-gates-v1043: ' + passed + ' passed, 0 failed');
