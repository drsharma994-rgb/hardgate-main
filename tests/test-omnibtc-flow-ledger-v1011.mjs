/* HARDGATE — hg-v1011: OMNIBTC'S REAL FLOW + THE FORWARD BOOK.

   Two gaps closed, both measured against the desk's own promises:

     1. REAL FLOW. contract-report's CVD row has always accepted a taker
        series (inp.takerSeries -> hgOmniCvd) and hgObtcGatherExtra never
        carried one — the row read the candle-approximated stand-in for the
        whole life of the desk, the same closes the momentum gates already
        read. The gather now fetches Binance's BTCUSDT taker long/short
        series (4h, 120 windows, cached) — the global price-discovery perp,
        the same cross-venue read the desk already makes for positioning.

     2. THE FORWARD BOOK. The desk has crowned one MOST PROBABLE per scan
        for its whole life and never recorded one — nothing could answer
        "does the crown pay?". The pick now records to hg-forward
        ('OMNIBTC', 4h, 20-bar horizon) carrying the winner leg's own tape
        (the central regime mark reads it) and the ticker's funding, dated
        on the tape's own last closed bar. The book renders under the card.

   Harness: the test-omnibtc.mjs route — classic scripts in a vm context,
   engines stubbed at the window, the REAL scan driven end to end. What is
   stubbed is said: the engine (swingTryClean / swingTryNear), the venue
   (xuUniverse / xuCandles), the report shell, the taker endpoint, and the
   ledger sink. The desk logic between them is the shipped code.

   Run: node tests/test-omnibtc-flow-ledger-v1011.mjs */
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
function stubPane(){
  const stubs = {};
  const pane = { _html: '', set innerHTML(v){ this._html = v; }, get innerHTML(){ return this._html; },
                 querySelector(sel){ if (!stubs[sel]) stubs[sel] = mk(); return stubs[sel]; },
                 querySelectorAll(){ return []; } };
  return { pane, stubs };
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
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'setup-ui.js', 'omnibtc-engines.js', 'omnibtc.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});   /* stubs land AFTER load — they win */
  return ctx;
}

/* The venue tape: 220 4h bars, t in SECONDS (the desk's own unit), a mild
   drift so indicators compute, last bar stamped LAST_T. */
const T4 = 14400, N4 = 220, LAST_T = 1760000000;
function bars(n, sec, lastT){
  const rows = [];
  for (let i = 0; i < n; i++){
    const c = 100 + i * 0.05;
    rows.push({ t: lastT - (n - 1 - i) * sec, o: c - 0.02, h: c + 0.3, l: c - 0.3, c, v: 100 + (i % 7) });
  }
  return rows;
}
const R4 = bars(N4, T4, LAST_T), R1 = bars(180, 3600, LAST_T), R15 = bars(180, 900, LAST_T), R1D = bars(260, 86400, LAST_T);
const TSERIES = (function(){ const s = []; for (let k = 119; k >= 0; k--) s.push({ buySellRatio: 1.2, t: LAST_T - k * T4 }); return s; })();
const PLAN = { dir: 'long', entry: 100, stop: 90, t1: 120, t2: 135, clean: true, passed: 7, total: 7 };

function venueStubs(cap){
  return {
    xuUniverse: async () => [{ sym: 'BTCUSD', base: 'BTC', exchange: 'delta', fundingPct: 0.011, mark: 105 }],
    xuCandles: async (item, tf) => (tf === '4h' ? R4 : tf === '1h' ? R1 : tf === '15m' ? R15 : R1D),
    binanceTakerRatio: async (sym, period, limit) => { cap.tkArgs = [sym, period, limit]; return { latest: TSERIES[TSERIES.length - 1], series: TSERIES }; },
    hgContractReportRun: (inp) => { cap.taker = inp && inp.takerSeries; return { sym: 'BTCUSD', sections: [], indicators: [], plan: { ok: false } }; },
    hgFwdRecordScan: (tab, tf, rows, opts) => { cap.rec = { tab, tf, rows, opts }; return 1; },
    hgFwdPanelHTML: (tab) => 'FWD:' + tab,
    hgPickMostProbableAny: (rows) => ({ row: rows[0], tier: rows[0] && rows[0].clean ? 'clean' : 'near' })
  };
}

console.log('== the gather feeds the CVD seam real flow ==');
{
  const cap = {};
  const W = boot({ binanceTakerRatio: async (s, p, l) => { cap.args = [s, p, l]; return { latest: TSERIES[0], series: TSERIES }; } });
  const extra = await W.hgObtcGatherExtra('BTCUSD', { symbol: 'BTCUSD' });
  ok(extra.takerSeries === TSERIES, 'the bag carries the real taker series');
  ok(cap.args && cap.args[0] === 'BTCUSDT' && cap.args[1] === '4h' && cap.args[2] === 120,
     'BTCUSDT on the report\'s own 4h clock, 120 windows — the price-discovery perp, cached');

  const W2 = boot({ binanceTakerRatio: async () => { throw new Error('fapi down'); } });
  const e2 = await W2.hgObtcGatherExtra('BTCUSD', { symbol: 'BTCUSD' });
  ok(e2.takerSeries === null, 'a failed fetch is a null, never an error up — the stand-in answers, labelled');

  const W3 = boot();
  const e3 = await W3.hgObtcGatherExtra('BTCUSD', { symbol: 'BTCUSD' });
  ok(e3.takerSeries === undefined, 'no endpoint, no series — absent, never faked');
}

console.log('== the crowned pick joins the forward book ==');
{
  const cap = {};
  const W = boot(Object.assign({
    swingTryClean: () => Object.assign({}, PLAN),
    /* hg-v1051: the entry-refinement layer has its own dedicated tests
       (test-omnibtc-perfect-v1041) - here it passes through so this pin
       keeps proving the record writes exactly what the desk crowned */
    hgApplyExactEntry: (p) => Object.assign({}, p)
  }, venueStubs(cap)));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  const stat = await W.hgObtcRunScan(ui);
  ok(/MOST PROBABLE/.test(stat), 'the scan crowns: ' + stat);
  ok(cap.taker === TSERIES, 'the contract report received the REAL series, not the candle stand-in');
  ok(cap.rec && cap.rec.tab === 'OMNIBTC' && cap.rec.tf === '4h', 'the pick records under OMNIBTC on the 4h book');
  ok(Array.isArray(cap.rec.rows) && cap.rec.rows.length === 1, 'one pick, one record — the desk keeps ONE setup');
  const r = cap.rec.rows[0];
  ok(r.sym === 'BTCUSD' && r.dir === 'long' && r.entry === 100 && r.stop === 90 && r.t1 === 120,
     'the record carries the crowned levels verbatim');
  ok(r.ticket === true, 'a CLEAN-tier crown is a ticket');
  ok(r.mechanic === 'SWING', 'the mechanic names the analogue-mapped kind, uppercased');
  ok(r.fundingPct === 0.011, 'the winner ticker\'s funding rides (hg-v985\'s central mark can read it)');
  ok(r.signalT === LAST_T && r.mark === R4[R4.length - 1].c,
     'dated on the tape\'s own last closed bar, marked at its close — never the wall clock');
  ok(Array.isArray(r.rows4h) && r.rows4h.length === 220 && r.rows4h[0].t === R4[0].t,
     'the winner leg\'s own 4h tape rides — the central regime mark needs the series the desk held');
  ok(cap.rec.opts && cap.rec.opts.horizonBars === 20, 'the house default 20-bar horizon, like every 4h writer');
  ok(ui.fwd.innerHTML === 'FWD:OMNIBTC', 'the book renders under the card after the scan');
}

console.log('== a watch-tier pick records marked for what it is ==');
{
  const cap = {};
  const W = boot(Object.assign({
    swingTryNear: () => ({ dir: 'short', entry: 110, stop: 118, t1: 96, passed: 6 }),
    hgApplyExactEntry: (p) => Object.assign({}, p)   /* refinement has its own tests */
  }, venueStubs(cap)));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  const stat = await W.hgObtcRunScan(ui);
  ok(cap.rec && cap.rec.rows.length === 1, 'the nearest watch is still the desk\'s output — it records');
  ok(cap.rec.rows[0].ticket === false && cap.rec.rows[0].dir === 'short' && cap.rec.rows[0].entry === 110,
     'ticket:false on a watch — the ledger distinguishes a crown from a watch');
}

console.log('== WAIT records nothing — an empty scan invents no history ==');
{
  const cap = {};
  const W = boot(venueStubs(cap));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  const stat = await W.hgObtcRunScan(ui);
  ok(/no engine produced a ticket|WAIT/i.test(stat), 'the desk waited: ' + stat);
  ok(cap.rec === undefined, 'no crown, no record — the book never mints a row the desk did not stand behind');
  ok(ui.fwd.innerHTML === 'FWD:OMNIBTC', 'the book still renders on a WAIT — the accumulating record is the point');
}

console.log('== the mount wires the panel ==');
{
  const W = boot({ hgFwdPanelHTML: (tab) => 'FWD:' + tab });
  const reg = W.HG_tabs.filter(function(t){ return t.id === 'omnibtc'; })[0];
  ok(reg && typeof reg.mount === 'function', 'the OMNIBTC tab is registered');
  const { pane, stubs } = stubPane();
  reg.mount(pane);
  ok(pane._html.indexOf('id="obtcFwd"') >= 0 && pane._html.indexOf('FORWARD — DOES THE CROWN PAY?') >= 0,
     'the mount carries the FORWARD section with its own container');
  ok(stubs['#obtcFwd'] && stubs['#obtcFwd'].innerHTML === 'FWD:OMNIBTC',
     'the book paints on mount — records from previous sessions are the point of a ledger');
}

console.log('== wiring pins — the shipped file actually does it ==');
{
  const src = read('omnibtc.js');
  /* hg-v1046: the record is priced on the crown's OWN grid now — a scalp
     records on 15m/24 and hands its own tape; a swing keeps 4h/20 */
  ok(src.indexOf("W.hgFwdRecordScan('OMNIBTC', fwdTf, [fwdRow], { horizonBars: fwdHorizon })") >= 0,
     'the record call names the desk and prices the horizon on the crown\'s own grid');
  ok(/fwdRow\.rows4h = winnerRows/.test(src), 'the winner leg\'s 4h tape rides a swing record');
  ok(/fwdScalp = \/SCALP\|TRAP\/i\.test\(fwdEng\)/.test(src), 'the scalp family is named by its engines');
  ok(/ticket: String\(pick\.tier/.test(src), 'the ticket flag reads the tier, never assumed');
  ok(src.indexOf('FORWARD LEDGER ........... hg-v1011') >= 0 && src.indexOf('REAL-FLOW CVD ............ hg-v1011') >= 0,
     'the header documents both halves of the pack');
  const esrc = read('omnibtc-engines.js');
  ok(/binanceTakerRatio\('BTCUSDT', '4h', 120\)/.test(esrc), 'the gather fetches the real series on the 4h clock');
  ok(/extra\.takerSeries === undefined/.test(esrc), 'a desk-handed series is never overwritten');
}

console.log('\ntest-omnibtc-flow-ledger-v1011: ' + passed + ' passed, 0 failed');
