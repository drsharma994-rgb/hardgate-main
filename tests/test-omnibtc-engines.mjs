/* HARDGATE — OMNIBTC extra engines.

   Extra CRYPTO desks pointed at BTC. They may mint a watch from an existing
   house planner. They may never claim 7/7 CLEAN. Evidence confirms, demotes
   or refuses. Silent feeds stay UNCHECKED.

   Run: node tests/test-omnibtc-engines.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(extra){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.HG_tabs = [];
  ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = {
    createElement: () => ({ style:{}, innerHTML:'', appendChild(){}, setAttribute(){},
      addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] }),
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    head: { appendChild(){} },
    body: { appendChild(){} },
    documentElement: { appendChild(){} },
    addEventListener(){}
  };
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'omnibtc-engines.js', 'omnibtc.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

const PLAN = { dir: 'long', entry: 100, stop: 90, t1: 120, t2: 135 };
const TICKER = { symbol: 'BTCUSD', exchange: 'delta', mark: 100, fundingPct: -0.01 };
const BARS = Array.from({ length: 80 }, (_, i) => ({
  t: 1700000000 + i * 14400, o: 100, h: 104, l: 96, c: 100, v: 10
}));

console.log('== extra engines never claim 7/7 CLEAN ==');
{
  const W = boot();
  W.smartSetup = function(){ return Object.assign({}, PLAN); };
  W.oiflowSetup = function(){ return Object.assign({}, PLAN, { dir: 'short', t1: 80, stop: 110 }); };
  W.swingTryFundingFade = function(){ return Object.assign({}, PLAN, { dir: 'short', t1: 80, stop: 110 }); };
  W.pineSmcCore = function(){ return Object.assign({}, PLAN); };
  W.stSynthesize = function(){ return { plan: Object.assign({}, PLAN, { clean: true }), tier: 'PRIME', planDraft: false }; };
  W.smartClassify = function(){ return { dir: 'long' }; };
  W.oiflowClassify = function(){ return { dir: 'short' }; };
  const run = W.hgObtcRunExtraEngines(BARS, BARS, BARS, TICKER, { smart: { fundingPct: -0.02, retailLongPct: 70 } });
  ok(run && Array.isArray(run.candidates), 'extra runner returns candidates');
  ok(run.candidates.every(function(c){ return c.clean === false; }),
    'no extra engine stamps clean:true — 7/7 stays on swingTryClean / scalpTryClean');
  ok(run.candidates.some(function(c){ return /SMART/.test(c.engine || ''); }),
    'SMART $ reaches the bag when classify + setup fire');
  ok(run.candidates.some(function(c){ return /OI FLOW/.test(c.engine || ''); }),
    'OI FLOW reaches the bag when classify + setup fire');
  ok(run.candidates.some(function(c){ return /funding fade/i.test(c.engine || ''); }),
    'funding fade is opted in deliberately, not via swingTryClean');
  ok(run.candidates.some(function(c){ return /SMC/.test(c.engine || ''); }),
    'SMC ChoCh with levels is a watch, not a derived invent');
  ok(run.candidates.some(function(c){ return /STAR TRADER/.test(c.engine || ''); }),
    'STAR TRADER synthesis with a plan is read');
  const st = run.candidates.filter(function(c){ return /STAR TRADER/.test(c.engine || ''); })[0];
  ok(st && st.near === true && st.clean === false,
    'a PRIME STAR TRADER plan does not mint a second 7/7 badge');
}

console.log('\n== missing engines stay idle — they do not invent ==');
{
  const W = boot();
  const run = W.hgObtcRunExtraEngines(BARS, BARS, BARS, TICKER, {});
  ok(run.candidates.length === 0, 'no stubbed engine → no invented extra ticket');
  ok(run.ledger.some(function(r){ return r.name === 'COIL' && r.state === 'idle'; }),
    'COIL is logged idle when the squeeze gates fail');
  ok(run.ledger.some(function(r){ return r.name === 'DIV' && r.state === 'idle'; }),
    'DIV is logged idle when no pivot divergence prints');
  ok(run.ledger.some(function(r){ return r.name === 'TRAP' && r.state === 'idle'; }),
    'TRAP is logged idle when no sweep-and-reclaim prints');
}

console.log('\n== COIL / DIV / TRAP use the tab gates ==');
{
  const W = boot();
  W.bollinger = function(){
    return { widthPct: Array(80).fill(2).map(function(_, i){ return i === 79 ? 1 : 2; }), mid: Array(80).fill(100),
      lower: Array(80).fill(90), upper: Array(80).fill(110) };
  };
  W.volZ = function(){ return -0.8; };
  W.ema = function(){ return Array(80).fill(90); };
  W.hgPlanLevels = function(){ return Object.assign({}, PLAN); };
  const coil = W.hgObtcTryCoil(BARS);
  ok(coil && coil.forming === true && coil.clean === false,
    'a coil that clears the tab gates is forming, not CLEAN');

  W.volZ = function(){ return 0.2; };
  ok(W.hgObtcTryCoil(BARS) === null, 'COIL: volZ ≥ -0.5 is the tab\'s own refuse');
}

console.log('\n== evidence confirms / demotes / refuses — never mints ==');
{
  const W = boot();
  const long = { dir: 'long', entry: 100, stop: 90, t1: 120, clean: true };
  const quiet = W.hgObtcEvidenceDecide(long, {});
  ok(quiet.ok === true && quiet.refuse === false && quiet.demote === false,
    'silent evidence does not fake a confirm or a refuse');
  ok(quiet.unchecked.indexOf('onchain') >= 0, 'missing on-chain is UNCHECKED');

  const demote = W.hgObtcEvidenceDecide(long, {
    onchain: { bias: 'bearish', flags: { feeSpike: true, congestion: 'clogged' } }
  });
  ok(demote.demote === true && demote.refuse === false,
    'a bearish fee-spike against a long demotes — it does not invent a short');

  const refuse = W.hgObtcEvidenceDecide(long, { flow: { veto: true, reason: 'cvd against' } });
  ok(refuse.ok === false && refuse.refuse === true, 'a flow-trap veto refuses the row');

  const applied = W.hgObtcApplyEvidence(Object.assign({}, long), null, {
    onchain: { bias: 'bearish', flags: { feeSpike: true } }
  });
  ok(applied.ok === true && applied.row.clean === false && applied.row.near === true,
    'apply demotes a CLEAN badge to watch — it does not change the levels');
  ok(applied.row.entry === 100 && applied.row.stop === 90 && applied.row.t1 === 120,
    'demote leaves ENTRY / STOP / T1 untouched');

  const dropped = W.hgObtcApplyEvidence(Object.assign({}, long), null, {
    postGate: { ok: false, reason: 'stale momentum' }
  });
  ok(dropped.ok === false && dropped.row === null, 'a post-gate veto drops the candidate');
}

console.log('\n== pick drops a refused extra row ==');
{
  const W = boot();
  W.hgObtcApplyEvidence = function(n){
    if (n.engine === 'TRAP') return { ok: false, row: null, ev: { refuse: true } };
    return { ok: true, row: n };
  };
  const clean = {
    sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, t1: 104, t2: 106,
    clean: true, passed: 7, engine: 'SWING clean plan'
  };
  const trap = {
    sym: 'BTCUSD', dir: 'short', entry: 99, stop: 101, t1: 95,
    clean: false, near: true, engine: 'TRAP'
  };
  const pick = W.hgObtcPick([clean, trap]);
  ok(pick && pick.row.engine === 'SWING clean plan', 'refused TRAP does not beat a real CLEAN');
}

console.log('\n== wiring: script, shell, header honesty ==');
{
  const html = read('index.html');
  const sw = read('sw.js');
  const src = read('omnibtc.js');
  const eng = read('omnibtc-engines.js');
  ok(/omnibtc-engines\.js/.test(html), 'index.html loads omnibtc-engines.js');
  ok(html.indexOf('omnibtc-engines.js') < html.indexOf('omnibtc.js?v='),
    'omnibtc-engines.js loads BEFORE omnibtc.js');
  ok(/\.\/omnibtc-engines\.js/.test(sw), 'sw.js HG_SHELL precaches omnibtc-engines.js');
  ok(/hgObtcRunExtraEngines/.test(src), 'the scan actually calls the extra runner');
  ok(/hgObtcGatherExtra/.test(src), 'the scan gathers SMART $ / on-chain snaps');
  ok(/hgObtcApplyEvidence/.test(src), 'pick applies evidence before rank');
  ok(/never claim 7\/7/.test(src) || /never claim 7\/7/.test(eng),
    'the header states extra engines never claim 7/7 CLEAN');
  ok(/APEX/.test(eng) && /alts versus BTC/.test(eng),
    'APEX is named as skipped because it is alts versus BTC');
}

console.log('\npassed: ' + passed);
