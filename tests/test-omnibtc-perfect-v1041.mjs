/* HARDGATE — hg-v1041/v1042: OMNIBTC READS ALL SEVEN PERFECT EVIDENCE LEGS
   PLUS THE COST + TIMING WITNESS BUNDLE.

   The shared PERFECT predicate (hg-perfect-setup.js) consumes seven evidence
   legs — taker flow, perp funding, volatility regime, structure trend, news
   calendar, session volume and the RVOL volume witness. OMNIBTC fed only
   three (flow, funding, news) and left the other four permanently UNREAD on
   data the desk already held: the winner's own 4h tape.

   hg-v1041 reads the remaining four (ATR percentile regime, EMA50/200
   structure trend, fire-bar RVOL -> session + volume witness) and prints the
   PERFECT CRITERIA LEDGER beside the pick so every leg the predicate consumed
   is visible with its measured value and verdict.

   hg-v1042 adds the cost + timing witnesses on top: round-trip cost in R
   (hgCryptoCostR), time-of-day session participation (hgSlotMeanVol),
   day-range exhaustion and the cross-venue funding spread (Binance BTCUSDT
   vs the venue ticker). All evidence, never a gate.

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
  for (const f of ['indicators.js', 'indicators2.js', 'hg-gates.js', 'hg-perfect-setup.js', 'hg-setup-core.js',
                   'crypto-position-risk.js', 'formation.js', 'plans.js', 'setup-ui.js', 'omnibtc-engines.js', 'omnibtc.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});   /* stubs land AFTER load — they win */
  return ctx;
}

const T4 = 14400, N4 = 220, LAST_T = 1760000000;
/* The crafted 4h tape: rising closes (EMA50 > EMA200 -> structure 'up'), the
   trailing 100 ATRs split wide/narrow so the last ATR (mid width) ranks
   mid-percentile -> HEALTHY, and a controllable fire-bar volume. */
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
    binanceFunding: async () => ({ fundingPct: 0.004, markPrice: 105, nextFundingTime: 0 }),
    hgContractReportRun: (inp) => { cap.taker = inp && inp.takerSeries; return { sym: 'BTCUSD', sections: [], indicators: [], plan: { ok: false } }; },
    hgFwdRecordScan: (tab, tf, rows, opts) => { cap.rec = { tab, tf, rows, opts }; return 1; },
    hgFwdPanelHTML: (tab) => 'FWD:' + tab,
    hgFwdPool: (tab) => (tab === 'OMNIBTC' ? { 'SWING': { samples: 40, hit: 0.55, expR: 0.3 } } : {}),
    hgPickMostProbableAny: (rows) => ({ row: rows[0], tier: rows[0] && rows[0].clean ? 'clean' : 'near' })
  };
}

console.log('== all seven legs readable-and-WITH crowns PERFECT⁺ and prints the ledger + witnesses ==');
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
  ok(/Structure trend<\/span><span class="v ok">WITH/.test(d), 'the structure leg shows its verdict: EMA50 above EMA200 = WITH for the long');
  ok(d.indexOf('RVOL 3.00') >= 0, 'the volume witness shows its measured value');
  ok(/Volatility regime<\/span><span class="v ok">WITH/.test(d), 'the volatility regime leg reads WITH (mid ATR percentile)');
  ok(/Perp funding<\/span><span class="v ok">WITH/.test(d), 'the funding leg reads WITH (long collects at -0.002)');
  /* hg-v1042 bundle: the cost + timing witnesses */
  ok(d.indexOf('TRADE COST + TIMING WITNESSES') >= 0, 'the cost + timing witnesses panel prints beside the pick');
  ok(d.indexOf('Round-trip cost') >= 0 && d.indexOf('R of the risk window') >= 0, 'the round-trip cost row shows fees in R');
  ok(d.indexOf('Session participation') >= 0 && d.indexOf('time-of-day norm') >= 0, 'the session participation row shows the fire bar against its own slot');
  ok(d.indexOf('Day range') >= 0 && d.indexOf('% consumed') >= 0, 'the day-range exhaustion row shows how much of the day is spent');
  ok(d.indexOf('Venue premium') >= 0 && d.indexOf('vs Binance') >= 0, 'the cross-venue funding spread row shows Delta vs Binance');
  ok(d.indexOf('Venue confirmation') >= 0, 'the venue-confirmation witness prints beside the pick');
  ok(d.indexOf('single venue only') >= 0, 'a single-venue scan says so honestly');
  ok(d.indexOf('THE CALL') >= 0, 'the call line prints first');
  ok(d.indexOf('LONG - TICKET') >= 0, 'the call names the direction and the tier unambiguously');
  ok(d.indexOf('SCALP TARGET') >= 0, 'the scalp target prints beside the crown');
  ok(d.indexOf('draft ladder ATR15') >= 0 && d.indexOf('DRAFT') >= 0, 'without a 15m matrix the ladder is honestly stamped DRAFT');
  ok(/ENTRY<\/span><span class="v">[0-9.]+/.test(d), 'the scalp block carries an entry');
  ok(d.indexOf('CROWN VERDICT') >= 0, 'the crown verdict line prints on top');
  ok(d.indexOf('TICKET') >= 0 && d.indexOf('PERFECT+') >= 0 && d.indexOf('EDGE ACCUMULATING') >= 0, 'the verdict names the ticket, the PERFECT+ badge and the measured state');
  /* the entry is refinement-moved in this scenario, so the distance is
     asserted by shape, not by the pre-refinement number */
  ok(d.indexOf('Mark distance') >= 0 && /mark is [0-9.]+% (ABOVE|BELOW) the entry/.test(d), 'the mark-distance witness prints the mark vs the crowned entry');
  ok(d.indexOf('ENGINE SCOREBOARD') >= 0 && d.indexOf('n=40 - hit 55% - expR +0.30R') >= 0, 'the engine scoreboard prints the settled per-engine record');
  ok(d.indexOf('SETUP CARD') >= 0, 'the prompt setup card prints');
  ok(d.indexOf('Market Thesis') >= 0 && d.indexOf('structure: EMA50/200') >= 0 && d.indexOf('momentum: RSI') >= 0, 'the 2-sentence market thesis prints from the measured reads');
  ok(d.indexOf('Bias') >= 0 && d.indexOf('LONG') >= 0, 'the setup block names the bias');
  ok(d.indexOf('Entry Zone') >= 0 && d.indexOf('Invalidation (SL)') >= 0, 'the setup block carries the zone and the invalidation');
  ok(/TP1 [0-9.]+ \| TP2 [0-9.]+ \| TP3/.test(d), 'the three targets print (TP3 as extension)');
  ok(d.indexOf('EXTENSION - not graded') >= 0, 'TP3 is honestly stamped as the ungraded extension');
  ok(/Risk\/Reward<\/span><span class="v">[0-9.]+R vs TP1/.test(d), 'the R:R line is calculated against TP1');
  ok(d.indexOf('Indicator Convergence') >= 0, 'the convergence block prints');
  /* the JSON renders HTML-escaped inside the pre block */
  ok(d.indexOf('Automation Blueprint') >= 0 && d.indexOf('&quot;formation&quot;: &quot;PERFECT_PLUS&quot;') >= 0, 'the webhook JSON prints with the real formation');
  ok(d.indexOf('&quot;exitPolicy&quot;: &quot;scale50_t1_be_trail&quot;') >= 0 && d.indexOf('&quot;venue&quot;: &quot;delta&quot;') >= 0, 'the payload carries the exit policy and the venue');
  ok(d.indexOf('PLAN MATH') >= 0, 'the plan-math panel prints');
  ok(d.indexOf('Break-even requirement') >= 0 && d.indexOf('T1 wins to break even') >= 0, 'the break-even line names what the numbers require');
  ok(d.indexOf('Timeframe agreement') >= 0 && d.indexOf('4h WITH') >= 0 && d.indexOf('1d WITH') >= 0, 'the timeframe agreement reads every tape (all WITH on the fixture)');
  ok(d.indexOf('LONDON session') >= 0, 'the fire bar session is named');
  ok(d.indexOf('Fill odds') >= 0 && d.indexOf('12-bar windows') >= 0, 'the fill-odds witness prints');
  ok(d.indexOf('Stop sensitivity') >= 0 && d.indexOf('0/40 prior bars wicked') >= 0, 'the stop-sensitivity witness prints the tape truth');
  ok(cap.tkArgs && cap.tkArgs[0] === 'BTCUSDT', 'the taker-series fetch still names BTCUSDT');
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
  ok(rec && rec.perfect === undefined, 'RVOL 0.30 is a THIN tape — the session + volume legs read AGAINST and the crown is not PERFECT');
  ok(ui.detail.innerHTML.indexOf('PERFECT CRITERIA LEDGER') < 0, 'no ledger on a thin tape');
}

console.log('== a 15m-priced scalp crown records on ITS OWN grid ==');
{
  const cap = {};
  const W = boot(Object.assign({
    scalpTryClean: () => Object.assign({}, PLAN, { engine: 'SCALP clean plan' })
  }, stubs(cap, -0.002, R4)));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  const stat = await W.hgObtcRunScan(ui);
  ok(/MOST PROBABLE/.test(stat), 'the scalp crowns: ' + stat);
  ok(cap.rec && cap.rec.tf === '15m', 'the record rides the 15m book, not the 4h one');
  ok(cap.rec && cap.rec.opts && cap.rec.opts.horizonBars === 24, 'the scalp horizon is the house 24 bars (6h)');
  const rr = cap.rec && cap.rec.rows && cap.rec.rows[0];
  ok(rr && Array.isArray(rr.rows) && rr.rows.length >= 60, 'the scalp record hands its own 15m tape under the rows carrier');
  ok(rr && rr.rows4h === undefined, 'and does not hand the 4h tape to a 15m record');
  ok(rr && rr.venueAgreeCount === 1, 'the venue-confirmation mark rides the record');
}

console.log('== the liquidation + volume reads print when the map speaks ==');
{
  const cap = {};
  const W = boot(Object.assign(stubs(cap, -0.002, R4), {
    swingTryClean: () => Object.assign({}, PLAN),
    hgContractReportRun: () => ({ sym: 'BTCUSD', sections: [{ id: 'omniinfo', rows: [
      { name: 'Liquidation map', detail: 'stop sits inside' },
    ] }], indicators: [], plan: { ok: false } })
  }));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  await W.hgObtcRunScan(ui);
  const d = ui.detail.innerHTML;
  ok(d.indexOf('Liquidation map') >= 0 && d.indexOf('SL-hunt risk') >= 0, 'the stop-in-cluster read prints');
}

console.log('== entry-edge refinement: accepted when the 2.0R floor survives ==');
{
  const cap = {};
  const W = boot(Object.assign(stubs(cap, -0.002, R4), {
    swingTryClean: () => Object.assign({}, PLAN),
    hgApplyExactEntry: (p) => Object.assign({}, p, { entry: 99 })
  }));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  await W.hgObtcRunScan(ui);
  const rr = cap.rec && cap.rec.rows && cap.rec.rows[0];
  ok(rr && rr.entry === 99, 'the record carries the refined entry (99)');
  ok(rr && rr.entryRefined === true, 'the refinement stamp rides the record');
}

console.log('== entry-edge refinement: refused when the 2.0R floor breaks ==');
{
  const cap = {};
  const W = boot(Object.assign(stubs(cap, -0.002, R4), {
    swingTryClean: () => Object.assign({}, PLAN),
    hgApplyExactEntry: (p) => Object.assign({}, p, { entry: 101 })
  }));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  await W.hgObtcRunScan(ui);
  const rr = cap.rec && cap.rec.rows && cap.rec.rows[0];
  ok(rr && rr.entry === 100, 'a refinement that breaks the 2.0R floor is refused - the original levels stand');
  ok(rr && rr.entryRefined === undefined, 'no stamp on a refused refinement');
}

console.log('== measured ranking: the armed PROVEN mechanic takes the crown ==');
{
  const cap = {};
  const W = boot(Object.assign(stubs(cap, -0.002, R4), {
    swingTryClean: () => Object.assign({}, PLAN),
    scalpTryClean: () => Object.assign({}, PLAN, { engine: 'SCALP clean plan' }),
    /* the normalized scalp row's mechanic is whatever hgNormalizeSetupRow
       derives - everything but the SWING crown reads proven here */
    hgProvenEdgeVerdict: (scan, mech, o) => ({ state: mech !== 'SWING' ? 'proven' : 'unproven', n: 60, floor: 20 })
  }));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  await W.hgObtcRunScan(ui);
  const rr = cap.rec && cap.rec.rows && cap.rec.rows[0];
  ok(rr && rr.mechanic !== 'SWING' && rr.mechanic, 'the PROVEN mechanic takes the crown over the unproven first row (' + rr.mechanic + ')');
  ok(rr && rr.ticket === true, 'and the proven crown stays a ticket');
}

console.log('== wiring pins — the shipped files actually read and print it all ==');
{
  const src = read('omnibtc.js');
  ok(src.indexOf('function hgObtcFireRvol') >= 0, 'the RVOL reader is defined');
  ok(src.indexOf('function hgObtcStructureTrend') >= 0, 'the structure-trend reader is defined');
  ok(src.indexOf('function hgObtcPerfectLedgerHtml') >= 0, 'the criteria ledger is defined');
  ok(src.indexOf('pfReads.atrRegime') >= 0 && src.indexOf('pfReads.structureTrend') >= 0 && src.indexOf('pfReads.sess') >= 0,
     'all four new legs ride the reads bag the predicate consumes');
  ok(src.indexOf('perfectReads = pfReads') >= 0, 'the ledger reads the same bag the predicate consumed');
  ok(src.indexOf('hgObtcPerfectLedgerHtml(pick)') >= 0, 'the ledger is painted in the detail pass');
  ok(src.indexOf('function hgObtcDayExhaustion') >= 0, 'the day-range exhaustion reader is defined');
  ok(src.indexOf('function hgObtcEvidenceWitnessesHtml') >= 0, 'the cost + timing witnesses panel is defined');
  ok(src.indexOf('pfReads.costR') >= 0 && src.indexOf('pfReads.slotRvol') >= 0 && src.indexOf('pfReads.dayExhaustionPct') >= 0,
     'cost, session and day-exhaustion reads ride the same bag the predicate consumed');
  ok(src.indexOf('pfReads.btcFundingBinance') >= 0 && src.indexOf('pfReads.venueFundingPct') >= 0,
     'the cross-venue funding spread reads ride the bag');
  ok(src.indexOf('hgObtcEvidenceWitnessesHtml(pick)') >= 0, 'the witnesses are painted in the detail pass');
  ok(src.indexOf('function hgObtcPlanMathHtml') >= 0, 'the plan-math panel is defined');
  ok(src.indexOf('function hgObtcSessionOf') >= 0 && src.indexOf('function hgObtcTapeDir') >= 0, 'the session + tape-dir readers are defined');
  ok(src.indexOf('c._rows1d = r1d') >= 0, 'the daily tape rides the candidates');
  ok(src.indexOf('pfReads.fillPct') >= 0 && src.indexOf('pfReads.sweepCount') >= 0, 'the accuracy reads ride the same bag the predicate consumed');
  ok(src.indexOf('hgFillProbability(winnerRows') >= 0, 'the fill odds come from the house touch-rate read');
  ok(src.indexOf('hgApplyExactEntry') >= 0 && src.indexOf('rrAfter') >= 0, 'the entry refinement is wired with the 2.0R re-check');
  ok(src.indexOf('measured-rank') >= 0 && src.indexOf('measuredRanked') >= 0, 'the measured ranking is wired, fails open');
  ok(src.indexOf('pfReadsEntryRefined') >= 0, 'the refinement stamp is declared in the scan scope');
  ok(src.indexOf('function hgObtcVerdictHtml') >= 0 && src.indexOf('function hgObtcScoreboardHtml') >= 0, 'the verdict + scoreboard helpers are defined');
  ok(src.indexOf('pfReads.markDistPct') >= 0, 'the mark-distance read rides the bag');
  ok(src.indexOf('function hgObtcSetupCardHtml') >= 0, 'the setup-card renderer is defined');
  ok(src.indexOf('pfReads.atrVal') >= 0, 'the ATR value rides the bag for the zone and TP3');
  ok(src.indexOf('function hgObtcTheCallHtml') >= 0 && src.indexOf('function hgObtcScalpPlanHtml') >= 0, 'the call + scalp-plan helpers are defined');
  ok(src.indexOf('scalpPlan: scalpPlan') >= 0, 'the scalp plan rides the snap');
  const esrc = read('omnibtc-engines.js');
  ok(esrc.indexOf("binanceFunding('BTCUSDT')") >= 0, 'the gather fetches Binance BTCUSDT funding for the spread');
  const tsrc = read('trendtable.js');
  ok(tsrc.indexOf('function trendmxSlotChipHtml') >= 0, 'TREND MATRIX: the session chip is defined');
  ok(tsrc.indexOf('function trendmxDayChipHtml') >= 0, 'TREND MATRIX: the day-exhaustion chip is defined');
  ok(tsrc.indexOf('function trendmxCostChipHtml') >= 0, 'TREND MATRIX: the round-trip cost chip is defined');
  ok(tsrc.indexOf('trendmxSlotChipHtml(r) + trendmxDayChipHtml(r) + trendmxCostChipHtml(r, plan)') >= 0,
     'TREND MATRIX: the three chips ride the plan block');
}

console.log('\ntest-omnibtc-perfect-v1041: ' + passed + ' passed, 0 failed');
