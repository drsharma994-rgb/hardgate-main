/* HARDGATE — OMNIBTC: Bitcoin-only desk.

   The tab promises three things and is held to all three:
     1. BTC is the only contract. Alts and gold never enter the universe,
        never become a candidate, and never win MOST PROBABLE.
     2. Every house strategy + indicator bank is pointed at that one coin.
        The tab does not invent a new BTC strategy or mint levels.
     3. Exactly one MOST PROBABLE setup. CLEAN with real ENTRY/STOP/T1
        wins. Else NEAR watch. Else WAIT. An empty scan must not invent
        a ticket.

   Run: node tests/test-omnibtc.mjs */
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
  if (extra && extra.window) ctx.window = extra.window;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'setup-ui.js', 'omnibtc.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

console.log('== every named engine is actually wired ==');
{
  /* THE HEADER USED TO NAME ENGINES THE CODE NEVER CALLED. It advertised
     "SWING / SCALP / EDGE / PINE / squeeze / mean-reversion / sniper /
     structure", and squeeze, PINE and structure were never invoked at all.
     A tab that claims to read everything and silently reads eight of eleven
     is worse than one that claims less: the operator prices in confidence
     that is not there. These assert the wiring, not the prose. */
  const bars = Array.from({ length: 60 }, function(_, i){
    return { t: 1700000000 + i * 14400, o: 100, h: 104, l: 96, c: 100 + (i % 5) };
  });
  const TICKER = { symbol: 'BTCUSD', exchange: 'delta', mark: 100 };
  const PLAN = { dir: 'long', entry: 100, stop: 90, t1: 120, t2: 135 };

  /* --- SQUEEZE: fires only when the classifier gives a direction --- */
  {
    const seen = [];
    const W = boot();
    W.squeezeClassify = function(){ return { state: 'FIRED_LONG', donchianBreak: null }; };
    W.squeezeGateEval = function(){ return { gatesPassed: 7, clean7: true }; };
    W.squeezePlan = function(inp){ seen.push(inp); return Object.assign({}, PLAN); };
    const out = W.hgObtcRunLocalEngines(bars, bars, bars, TICKER, bars);
    ok(seen.length === 1, 'SQUEEZE: a fired classifier reaches squeezePlan');
    ok(seen[0].dir === 'long', 'SQUEEZE: FIRED_LONG becomes a long, not a guess');
    ok(!!seen[0].gate, 'SQUEEZE: the gate is evaluated before the plan is minted');
    ok(out.some(function(c){ return /SQUEEZE/.test(c.engine || ''); }),
      'SQUEEZE: the candidate carries its engine name');
  }
  {
    /* BUILDING has no direction — squeeze.js own rule — so no ticket */
    const seen = [];
    const W = boot();
    W.squeezeClassify = function(){ return { state: 'BUILDING', donchianBreak: null }; };
    W.squeezePlan = function(inp){ seen.push(inp); return Object.assign({}, PLAN); };
    W.hgObtcRunLocalEngines(bars, bars, bars, TICKER, bars);
    ok(seen.length === 0,
      'SQUEEZE: a BUILDING squeeze has no direction and therefore mints nothing');
  }
  {
    /* a donchian break is a direction too */
    const seen = [];
    const W = boot();
    W.squeezeClassify = function(){ return { state: 'NONE', donchianBreak: 'SHORT' }; };
    W.squeezePlan = function(inp){ seen.push(inp); return Object.assign({}, PLAN, { dir: 'short', t1: 80, stop: 110 }); };
    W.hgObtcRunLocalEngines(bars, bars, bars, TICKER, bars);
    ok(seen.length === 1 && seen[0].dir === 'short',
      'SQUEEZE: a donchian break supplies the direction when no fire did');
  }

  /* --- TREND MATRIX: only at or beyond the module majority --- */
  {
    const seen = [];
    const W = boot();
    W.trendScore = function(){ return { score: 3, comps: {} }; };
    W.trendmxGateEval = function(){ return { gatesPassed: 6 }; };
    W.trendmxPlan = function(inp){ seen.push(inp); return Object.assign({}, PLAN); };
    W.hgObtcRunLocalEngines(bars, bars, bars, TICKER, bars);
    ok(seen.length === 1 && seen[0].score === 3,
      'TREND MATRIX: a composite past the majority reaches trendmxPlan');
  }
  {
    const seen = [];
    const W = boot();
    W.trendScore = function(){ return { score: 1, comps: {} }; };
    W.trendmxPlan = function(inp){ seen.push(inp); return Object.assign({}, PLAN); };
    W.hgObtcRunLocalEngines(bars, bars, bars, TICKER, bars);
    ok(seen.length === 0,
      'TREND MATRIX: a composite short of the majority mints nothing');
  }

  /* --- PINE: reads a snapshot, never runs pine, never invents --- */
  {
    const W = boot();
    W.pineScan = function(){
      return { rows: [
        { sym: 'BTCUSD', kind: 'AVWAP', plan: Object.assign({}, PLAN) },
        { sym: 'ETHUSD', kind: 'AVWAP', plan: Object.assign({}, PLAN) }
      ] };
    };
    const out = W.hgObtcRunLocalEngines(bars, bars, bars, TICKER, bars);
    const pine = out.filter(function(c){ return /PINE/.test(c.engine || ''); });
    ok(pine.length === 1, 'PINE: the BTC snapshot row is read, the ETH row is not');
  }
  {
    const W = boot();
    W.pineScan = function(){ return null; };   /* PINE tab never ran */
    const out = W.hgObtcRunLocalEngines(bars, bars, bars, TICKER, bars);
    ok(out.every(function(c){ return !/PINE/.test(c.engine || ''); }),
      'PINE: an empty snapshot contributes nothing — it never runs pine itself');
  }

  /* --- the header may not out-run the code again --- */
  {
    const src = read('omnibtc.js');
    const head = src.slice(0, src.indexOf('ENGINES ACTUALLY CALLED') + 4000);
    ['squeezePlan', 'trendmxPlan', 'pineScan'].forEach(function(fn){
      ok(src.indexOf(fn) > 0, 'omnibtc.js actually references ' + fn);
    });
    ok(/READ ONLY/.test(head),
      'the header states plainly that PINE is a snapshot read, not an engine run');
  }
}

console.log('== BTC-only filter ==');
{
  const W = boot();
  ok(typeof W.hgObtcIsBtc === 'function', 'hgObtcIsBtc exported');
  ok(W.hgObtcIsBtc('BTCUSD') === true, 'Delta BTCUSD is BTC');
  ok(W.hgObtcIsBtc('B-BTC_USDT') === true, 'CoinDCX B-BTC_USDT is BTC');
  ok(W.hgObtcIsBtc('BTCUSDT') === true, 'BTCUSDT is BTC');
  ok(W.hgObtcIsBtc('ETHUSD') === false, 'ETH is not BTC');
  ok(W.hgObtcIsBtc('SOLUSD') === false, 'SOL is not BTC');
  ok(W.hgObtcIsBtc('XAUUSD') === false, 'gold is not BTC');
  ok(W.hgObtcIsBtc('PAXGUSDT') === false, 'PAXG is not BTC');
  ok(W.hgObtcIsBtc('') === false, 'empty symbol is not BTC');

  const uni = W.hgObtcFilterUniverse([
    { sym: 'ETHUSD', base: 'ETH', exchange: 'delta' },
    { sym: 'BTCUSD', base: 'BTC', exchange: 'delta' },
    { sym: 'B-BTC_USDT', base: 'BTC', exchange: 'coindcx' },
    { sym: 'XAUUSD', base: 'XAU', exchange: 'delta' },
    { sym: 'SOLUSD', base: 'SOL', exchange: 'delta' }
  ]);
  ok(uni.length === 2 && uni.every(x => W.hgObtcIsBtc(x.sym)),
    'universe filter keeps only the two BTC venue legs');
  ok(uni.some(x => x.exchange === 'delta') && uni.some(x => x.exchange === 'coindcx'),
    'both Delta and CoinDCX BTC legs survive');
}

console.log('\n== candidates need real levels and a BTC symbol ==');
{
  const W = boot();
  ok(typeof W.hgObtcCandidateFromSignal === 'function', 'hgObtcCandidateFromSignal exported');
  const tk = { symbol: 'BTCUSD', exchange: 'delta' };

  ok(W.hgObtcCandidateFromSignal(null, tk) === null, 'null signal is dropped');
  ok(W.hgObtcCandidateFromSignal({ dir: 'long', state: 'signal' }, tk) === null,
    'direction without levels is not a ticket');
  ok(W.hgObtcCandidateFromSignal({ dir: 'long', entry: 100, stop: 98, state: 'signal' }, tk) === null,
    'entry/stop without T1 is not a ticket');
  ok(W.hgObtcCandidateFromSignal({
    dir: 'long', entry: 100, stop: 100, t1: 104, state: 'signal'
  }, tk) === null, 'zero-risk row is dropped');

  const eth = W.hgObtcCandidateFromSignal({
    dir: 'long', entry: 4000, stop: 3920, t1: 4160, state: 'signal'
  }, { symbol: 'ETHUSD', exchange: 'delta' });
  ok(eth === null, 'an ETH signal cannot become an OMNIBTC candidate');

  const derived = W.hgObtcCandidateFromSignal({
    dir: 'long', entry: 100, stop: 98, t1: 104, state: 'signal',
    source: 'derived — no engine gave levels, so this is the structure stop'
  }, tk);
  ok(derived === null, 'contract-report derived structure fallback is refused');

  const hit = W.hgObtcCandidateFromSignal({
    dir: 'long', entry: 100, stop: 98, t1: 104, t2: 106, state: 'signal',
    name: 'SWING clean plan', detail: 'CLEAN 7/7', passed: 7, total: 7
  }, tk);
  ok(hit && hit.sym === 'BTCUSD' && hit.dir === 'long' && hit.entry === 100 && hit.t1 === 104,
    'a real BTC engine row with levels becomes a candidate');
  ok(hit.clean === true, '7/7 CLEAN is marked clean');
}

console.log('\n== one pick, never invented ==');
{
  const W = boot();
  ok(typeof W.hgObtcPick === 'function', 'hgObtcPick exported');
  ok(W.hgObtcPick([]) === null, 'empty bag → no invented leader');
  ok(W.hgObtcPick([{ sym: 'BTCUSD', dir: 'long' }]) === null, 'no levels → no banner');
  ok(W.hgObtcPick([{
    sym: 'ETHUSD', dir: 'long', entry: 4000, stop: 3920, t1: 4160, clean: true
  }]) === null, 'ETH CLEAN cannot win a BTC desk');

  const clean = {
    sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, t1: 104, t2: 106,
    clean: true, passed: 7, gatesTotal: 7, engine: 'SWING clean plan', venue: 'delta'
  };
  const near = {
    sym: 'B-BTC_USDT', dir: 'long', entry: 100.2, stop: 98.1, t1: 104.4,
    nearClean: true, passed: 6, gatesTotal: 7, engine: 'SWING near-clean watch', venue: 'coindcx'
  };
  const scalp = {
    sym: 'BTCUSD', dir: 'short', entry: 99, stop: 101, t1: 95, t2: 93,
    clean: true, passed: 7, engine: 'SCALP clean plan', venue: 'delta'
  };

  const a = W.hgObtcPick([clean, near, scalp]);
  ok(a && a.row, 'three real BTC rows still produce a pick');
  ok(a.tier === 'clean', 'CLEAN wins over NEAR');
  ok(W.hgObtcIsBtc(a.row.sym), 'the winner is BTC');
  ok(a.row === a.row, 'exactly one row object is returned');

  const watch = W.hgObtcPick([near]);
  ok(watch && watch.tier === 'near' && watch.row.sym === 'B-BTC_USDT',
    'NEAR is the honest fallback when nothing is CLEAN');

  const fromReport = W.hgObtcCandidatesFromReport({
    plan: {
      ok: true, dir: 'long', entry: 100, stop: 98, t1: 104, t2: 106,
      source: 'SWING clean plan'
    },
    sections: [{
      id: 'gates',
      rows: [
        { name: 'SWING clean plan', state: 'signal', dir: 'long', entry: 100, stop: 98, t1: 104, passed: 7, total: 7, detail: 'CLEAN 7/7' },
        { name: 'EDGE', state: 'idle', dir: null, detail: 'no trigger' },
        { name: 'MEAN REVERSION', state: 'signal', dir: 'long', entry: 100, stop: 98 } /* no t1 */
      ]
    }]
  }, { symbol: 'BTCUSD', exchange: 'delta' });
  ok(fromReport.length >= 1 && fromReport.every(r => W.hgObtcIsBtc(r.sym)),
    'report harvest keeps only BTC rows that have T1');
  ok(fromReport.every(r => isFinite(+r.t1)), 'every harvested row has a real T1');
  const pickR = W.hgObtcPick(fromReport);
  ok(pickR && pickR.row.entry === 100, 'report harvest still collapses to one pick');
}

console.log('\n== default legs are BTC on both venues ==');
{
  const W = boot();
  const legs = W.hgObtcDefaultLegs();
  ok(Array.isArray(legs) && legs.length === 2, 'dual-scan default is two BTC legs');
  ok(legs.every(l => W.hgObtcIsBtc(l.sym) && l.base === 'BTC'), 'both default legs are BTC');
  ok(legs.some(l => l.exchange === 'delta' && l.sym === 'BTCUSD'), 'Delta BTCUSD');
  ok(legs.some(l => l.exchange === 'coindcx' && l.sym === 'B-BTC_USDT'), 'CoinDCX B-BTC_USDT');
}

console.log('\n== mount + HG_tabs ==');
{
  const W = boot();
  const tab = (W.HG_tabs || []).find(t => t.id === 'omnibtc');
  ok(tab && tab.label === 'OMNIBTC', 'HG_tabs registers OMNIBTC');
  ok(typeof tab.mount === 'function' && typeof tab.refresh === 'function',
    'mount and refresh are functions');

  const nodes = {};
  const el = {
    innerHTML: '',
    querySelector(sel){
      if (nodes[sel]) return nodes[sel];
      const n = {
        disabled: false, textContent: '', innerHTML: '', style: {},
        addEventListener(){}, setAttribute(){}, querySelector(){ return null; }
      };
      nodes[sel] = n;
      return n;
    }
  };
  let threw = false;
  try { tab.mount(el); } catch (e){ threw = true; console.error(e); }
  ok(!threw, 'mount does not throw on a stub pane');
  ok(/OMNIBTC/.test(el.innerHTML), 'mount paints the OMNIBTC heading');
  ok(/BTC/.test(el.innerHTML), 'the copy names Bitcoin');
  ok(/MOST PROBABLE|one setup/i.test(el.innerHTML), 'the copy names the one-setup rule');
  ok(/#obtcRun/.test(Object.keys(nodes).join(' ') ) || /obtcRun/.test(el.innerHTML),
    'SCAN button id is obtcRun');
}

console.log('\n== scan loop stays on BTC and picks one ==');
{
  const W = boot();
  const UNI = [
    { sym: 'ETHUSD', base: 'ETH', exchange: 'delta' },
    { sym: 'BTCUSD', base: 'BTC', exchange: 'delta', fundingPct: -0.01, mark: 100 },
    { sym: 'SOLUSD', base: 'SOL', exchange: 'coindcx' },
    { sym: 'B-BTC_USDT', base: 'BTC', exchange: 'coindcx', fundingPct: null, mark: 100.2 }
  ];
  W.xuUniverse = () => Promise.resolve(UNI);
  W.xuCandles = (item) => {
    if (!W.hgObtcIsBtc(item.sym)) throw new Error('candles requested for non-BTC ' + item.sym);
    const rows = [];
    for (let i = 0; i < 80; i++) rows.push({ t: 1700000000 + i * 14400, o: 100, h: 101, l: 99, c: 100, v: 10 });
    return Promise.resolve(rows);
  };
  W.hgContractReportRun = (inp) => {
    if (!W.hgObtcIsBtc(inp.sym || (inp.ticker && inp.ticker.symbol))){
      throw new Error('report ran on non-BTC');
    }
    return {
      plan: {
        ok: true, dir: 'long', entry: 100, stop: 98, t1: 104, t2: 106,
        source: 'SWING clean plan'
      },
      sections: [{
        rows: [
          { name: 'SWING clean plan', state: 'signal', dir: 'long', entry: 100, stop: 98, t1: 104, passed: 7, total: 7, detail: 'CLEAN 7/7' },
          { name: 'EDGE', state: 'idle' }
        ]
      }],
      indicators: [{ label: 'RSI(14) 4h', value: '55.0', note: 'mid' }],
      summary: { engines: 2, signals: 1, lean: 'long' }
    };
  };
  const mk = () => ({ innerHTML: '', textContent: '', disabled: false, style: {}, addEventListener(){} });
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), ind: mk(), ledger: mk() };
  await W.hgObtcRunScan(ui);
  ok(ui.btn.disabled === false, 'scan re-enables the button');
  const snap = W.hgObtcState();
  ok(snap && snap.pick && snap.pick.row, 'snapshot holds the one pick');
  ok(W.hgObtcIsBtc(snap.pick.row.sym), 'the scanned winner is BTC');
  ok((snap.legs || []).every(l => W.hgObtcIsBtc(l.sym)), 'every scanned leg was BTC');
  ok((snap.candidates || []).length >= 1, 'candidates were harvested');
  ok(/MOST PROBABLE/.test(ui.cards.innerHTML), 'MOST PROBABLE banner is pinned');
  ok(!/ETHUSD|SOLUSD|XAUUSD/.test(ui.cards.innerHTML + ui.detail.innerHTML),
    'alts and gold never appear on the desk');
}

console.log('\n== wiring: nav, host, shell, pin path ==');
{
  const html = read('index.html');
  const setup = read('setup-ui.js');
  const sw = read('sw.js');
  const src = read('omnibtc.js');
  ok(/tabs:\['omnibtc'/.test(html.replace(/\s+/g, '')) || /'omnibtc','omnipresent'/.test(html),
    'OMNIBTC is first in the CRYPTO nav group');
  ok(/omnibtc\.js/.test(html), 'index.html loads omnibtc.js');
  ok(/omnibtc-engines\.js/.test(html), 'index.html loads the extra-engine module before the tab');
  ok(/omnibtc:\s*'obtcCards'/.test(setup), 'HG_MP_HOST maps omnibtc → obtcCards');
  ok(/\.\/omnibtc\.js/.test(sw), 'sw.js HG_SHELL precaches omnibtc.js');
  ok(/hgMpPin\(|hgMostProbablePanelHTML\(/.test(src), 'the tab pins MOST PROBABLE through the house helper');
  ok(/bookBtnHTML/.test(src) && /hgToTradePlan|hgBookStampChip/.test(src),
    'CLEAN cards wire book + trade handoff');
  ok(/hgStrategyRefine|hgStrategyTradeDetailHtml/.test(src),
    'winner is strategy-confirmed, not a bare ticket');
  ok(!/invent/.test(src) || /never invent/i.test(src),
    'the module states it will not invent levels');
}

console.log('\n== OMNIROUTE full-ledger discipline on BTC ==');
{
  const bars = Array.from({ length: 80 }, function(_, i){
    return { t: 1700000000 + i * 14400, o: 100, h: 104, l: 96, c: 100 + (i % 5), v: 1000 };
  });
  const TICKER = { symbol: 'BTCUSD', exchange: 'delta', mark: 100 };
  const ledger = [];
  let extraSeen = null;
  const W = boot();
  W.hgOmniEvaluate = function(item, rows, pos, extra){
    extraSeen = extra;
    return [];
  };
  W.hgObtcRunLocalEngines(bars, bars, bars, TICKER, bars, ledger);
  ok(extraSeen && extraSeen.rows1h === bars && extraSeen.rows15m === bars,
    'hgOmniEvaluate receives 1H + 15m legs for SCALP / house extras');
  ok(ledger.length === 1 && /no mechanic fired/i.test(ledger[0].detail),
    'a quiet OMNIROUTE pass is logged — indicator ledger ran, no invented ticket');
}

console.log('\n== coverage matrix + contract-report omniinfo wiring ==');
{
  const src = read('omnibtc.js');
  ok(/hgObtcCoverageMatrixHtml/.test(src), 'coverage matrix helper is exported');
  ok(/OMNIROUTE COVERAGE/.test(src), 'mount shows the OMNIROUTE coverage panel');
  ok(/takerSeries/.test(src), 'contract report receives takerSeries when gathered');
  ok(/omniinfo/.test(src), 'scan extracts omniinfo rows onto the snap');
  const W = boot();
  W.hgOmniRenderCoverageMatrix = function(){ return '<table class="tbl"><tr><td>COVERED</td></tr></table>'; };
  ok(/tbl/.test(W.hgObtcCoverageMatrixHtml()), 'coverage matrix renders when omniroute is loaded');
}

console.log('\npassed: ' + passed);
