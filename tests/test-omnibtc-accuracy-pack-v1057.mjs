/* HARDGATE — hg-v1057: OMNIBTC ACCURACY PACK — trend quality, flow
   acceptance, leverage cycle, liquidation magnitudes, on-chain verdict,
   cycle context, spot-vs-perp CVD and basis momentum.

   Every leg is EVIDENCE FIRST: witness rows + PERFECT-badge legs + forward
   marks. Nothing here drops a ticket — an unreadable leg is null, and the
   shared predicate only vetoes the states the research says run against.

   Driven through the real shipped seams: hgObtcTrendQualityOf /
   hgObtcFlowAcceptance / hgObtcCvdSlopeDir / hgObtcUsdOf / hgObtcNetflowZOf /
   hgObtcCycleContextHtml / hgObtcEvidenceWitnessesHtml (omnibtc.js),
   hgPerfectFormation (hg-perfect-setup.js), and the real hgObtcRunScan end
   to end with the house stubs, exactly like test-omnibtc-perfect-v1041.

   Run: node tests/test-omnibtc-accuracy-pack-v1057.mjs */
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
                   'crypto-position-risk.js', 'formation.js', 'plans.js', 'setup-ui.js',
                   'onchain-alt-data.js', 'omnibtc-engines.js', 'omnibtc.js'])
    vm.runInContext(read(f), ctx, { filename: f });
  Object.assign(ctx, extra || {});
  return ctx;
}

/* ---- tapes: a clean trend (TREND), an alternating chop (CHOP) ---- */
const T4 = 14400, N4 = 220, LAST_T = 1760000000;
function tape(closeOf, rangeOf, volOf){
  const rows = [];
  for (let i = 0; i < N4; i++){
    const c = closeOf(i), r = rangeOf(i);
    rows.push({ t: LAST_T - (N4 - 1 - i) * T4, o: c - r / 4, h: c + r / 2, l: c - r / 2, c, v: volOf(i) });
  }
  return rows;
}
const TREND = tape(i => 100 + i * 1.0, () => 0.5, () => 100);           /* er ~1, chop ~10 -> TREND */
const CHOP  = tape(i => 100 + (i % 2), () => 0.5, () => 100);           /* er ~0, chop ~93 -> CHOP */
const R1   = tape(i => 100 + i * 0.05, () => 1.0, () => 100).slice(0, 180).map(function(r, i){ return Object.assign({}, r, { t: LAST_T - (179 - i) * 3600 }); });
const R15  = R1.map(function(r, i){ return Object.assign({}, r, { t: LAST_T - (179 - i) * 900 }); });
const R1D  = tape(i => 100 + i * 0.05, () => 1.0, () => 100).map(function(r, i){ return Object.assign({}, r, { t: LAST_T - (259 - i) * 86400 }); });

const PLAN = { dir: 'long', entry: 100, stop: 90, t1: 120, t2: 135, clean: true, passed: 7, total: 7 };
function ratioSeries(r){ const s = []; for (let k = 119; k >= 0; k--) s.push({ buySellRatio: r, t: LAST_T - k * T4 }); return s; }
function basisSeries(){ const s = []; for (let i = 0; i < 40; i++) s.push({ basisRatePct: i < 32 ? -0.4 : (-0.4 + (i - 32) * 0.1), t: LAST_T - (39 - i) * 28800 }); return s; }

/* omniInfo rows the report hands the desk: CVD against + USD liqui rows */
const OMNI_ROWS = [
  { name: 'CVD (OMNIROUTE)', state: 'idle', detail: 'taker flow against' },
  { name: 'Liquidation map (OMNIROUTE)', state: 'idle', detail: 'stop sits inside a liquidation cluster at 0.000010 ($52.3M projected) — stop-hunt risk' },
  { name: 'Liquidation map (OMNIROUTE)', state: 'signal', detail: 'cluster at 0.000012 ($17M projected) lies between entry and T1 — fuel toward the target' }
];
function scanStubs(cap, rows4h){
  return {
    xuUniverse: async () => [{ sym: 'BTCUSD', base: 'BTC', exchange: 'delta', fundingPct: -0.002, mark: 105 }],
    xuCandles: async (item, tf) => (tf === '4h' ? rows4h : tf === '1h' ? R1 : tf === '15m' ? R15 : R1D),
    swingTryClean: () => Object.assign({}, PLAN),
    binanceTakerRatio: async () => ({ latest: ratioSeries(1.2)[99], series: ratioSeries(1.2) }),
    binanceFunding: async () => ({ fundingPct: -0.002, markPrice: 105, nextFundingTime: 0 }),
    coinalyzeOIChg: async () => { cap.oiArgs = ['BTCUSDT', 24]; return { sym: 'BTCUSDT', chgPct: -12, hours: 24, at: 0 }; },
    binanceFundingHist: async () => { const a = []; for (let i = 0; i < 30; i++) a.push({ rate: 0.0001, t: LAST_T - (29 - i) * 28800 }); return a; },
    binanceSpotTakerFlow: async () => ({ latest: ratioSeries(1.2)[99], series: ratioSeries(1.2) }),
    binanceBasis: async () => ({ latest: basisSeries()[39], series: basisSeries() }),
    hgContractReportRun: () => ({ sym: 'BTCUSD', sections: [{ id: 'omniinfo', rows: OMNI_ROWS }], indicators: [], plan: { ok: false } }),
    hgFwdRecordScan: (tab, tf, rows, opts) => { cap.rec = { tab, tf, rows, opts }; return 1; },
    hgFwdPanelHTML: (tab) => 'FWD:' + tab,
    hgFwdPool: (tab) => (tab === 'OMNIBTC' ? { 'SWING': { samples: 40, hit: 0.55, expR: 0.3 } } : {}),
    hgPickMostProbableAny: (rows) => ({ row: rows[0], tier: rows[0] && rows[0].clean ? 'clean' : 'near' })
  };
}

console.log('== 1) trend quality: CHOP / TREND / null off the real tape ==');
{
  const W = boot();
  const chop = W.hgObtcTrendQualityOf(CHOP);
  ok(chop && chop.state === 'CHOP' && chop.chop >= 61.8 && chop.er < 0.3, 'an alternating tape reads CHOP (chop ' + chop.chop.toFixed(1) + ', er ' + chop.er.toFixed(2) + ')');
  const trend = W.hgObtcTrendQualityOf(TREND);
  ok(trend && trend.state === 'TREND' && trend.chop <= 38.2 && trend.er > 0.4, 'a clean trend reads TREND (chop ' + trend.chop.toFixed(1) + ', er ' + trend.er.toFixed(2) + ')');
  ok(W.hgObtcTrendQualityOf(TREND.slice(0, 20)) === null, 'a tape under 25 bars reads null — no verdict');
}

console.log('== 2) the shared predicate: new legs veto / with / absorb ==');
{
  const W = boot();
  const C = () => ({ grade: 'A', oppose: 0, tally: 5, entry: 100, stop: 90, t1: 120, dir: 'long' });
  const r = (reads) => W.hgPerfectFormation(C(), reads || {});
  ok(r({ takerFlowVerdict: 'against' }).perfect === false, "'against' still vetoes PERFECT");
  ok(r({ takerFlowVerdict: 'against' }).why.join(' ').indexOf('taker flow against') >= 0, '  and names the reason');
  const absorbed = r({ takerFlowVerdict: 'against-absorbed' });
  ok(absorbed.perfect === true && absorbed.plus === false, "'against-absorbed' does NOT veto (readable, not with — no PERFECT+ either)");
  ok(r({ trendQuality: 'CHOP' }).why.join(' ').indexOf('chop tape') >= 0, 'trend-quality CHOP vetoes and names the chop tape');
  ok(r({ trendQuality: 'CHOP' }).perfect === false, '  CHOP is not perfect');
  ok(r({ leverageState: 'EXTENDED' }).perfect === false, 'leverage EXTENDED vetoes');
  ok(r({ leverageState: 'RESET' }).plus === true, 'leverage RESET is the with-state (solo readable leg -> plus)');
  ok(r({ leverageState: 'FLAT' }).perfect === true && r({ leverageState: 'FLAT' }).plus === false, 'leverage FLAT is readable-neutral');
  ok(r({ onchainVeto: true }).perfect === false && r({ onchainVeto: true }).why.join(' ').indexOf('on-chain') >= 0, 'on-chain veto disqualifies');
  ok(r({ onchainVeto: false }).plus === true, 'a readable non-veto is WITH');
  ok(r({ cvdContext: 'AGAINST' }).perfect === false, 'cvd AGAINST vetoes');
  ok(r({ cvdContext: 'PERP-ONLY' }).perfect === false, 'cvd PERP-ONLY vetoes (leverage-driven, spot not participating)');
  ok(r({ cvdContext: 'BOTH-WITH' }).plus === true && r({ cvdContext: 'SPOT-ONLY' }).plus === true, 'cvd BOTH-WITH / SPOT-ONLY are the with-states');
}

console.log('== 3) acceptance + cvd slope + usd + netflow-z helpers ==');
{
  const W = boot();
  const rising = tape(i => 100 + i, () => 0.5, () => 100);
  const falling = tape(i => 200 - i, () => 0.5, () => 100);
  ok(W.hgObtcFlowAcceptance(rising, 'long', 3) === true, 'three advancing closes read accepted for a long');
  ok(W.hgObtcFlowAcceptance(falling, 'long', 3) === false, 'falling closes do not');
  ok(W.hgObtcFlowAcceptance(falling, 'short', 3) === true, 'the same tape reads accepted for a short');
  ok(W.hgObtcFlowAcceptance(rising.slice(0, 3), 'long', 3) === false, 'an unreadable tape is false, never a verdict');
  ok(W.hgObtcCvdSlopeDir(ratioSeries(1.2)) === true, 'buy-heavy taker series slopes up');
  ok(W.hgObtcCvdSlopeDir(ratioSeries(0.3)) === false, 'sell-dominant taker series (ratio 0.3 < the 0.5 zero of 2r-1) slopes down');
  ok(W.hgObtcCvdSlopeDir(ratioSeries(1.2).slice(0, 20)) === null, 'a short series is null');
  ok(W.hgObtcUsdOf('cluster at 0.1 ($517.2M projected)') === 517200000, '$517.2M parses to dollars');
  ok(W.hgObtcUsdOf('($25K projected)') === 25000, '$25K parses too');
  ok(W.hgObtcUsdOf('14 cluster(s) projected') === null, 'no figure = null, never an invented zero');
  ok(W.hgObtcNetflowZOf({ netflowZ: { z: 2.4 } }) === 2.4, 'a precomputed z object is read');
  ok(W.hgObtcNetflowZOf({ flows7d: [1, 2, 1, 2, 1, 2, 9] }) > 2, 'a 7-day flows series is scored through hgCalcNetflowZ');
  ok(W.hgObtcNetflowZOf({}) === null, 'absent data is null');
}

console.log('== 4) the CYCLE CONTEXT panel: UNREAD-never-faked, or the real rows ==');
{
  const W = boot();
  const bare = W.hgObtcCycleContextHtml({}, null);
  ok(bare.indexOf('CYCLE CONTEXT') >= 0, 'the panel renders');
  ok(bare.indexOf('UNREAD — needs realized-cap data, never faked') >= 0, 'MVRV-Z prints UNREAD, never faked');
  ok(bare.indexOf('UNREAD — needs UTXO-level on-chain data, never faked') >= 0, 'SOPR prints UNREAD, never faked');
  ok(bare.indexOf('Miner cycle') >= 0 && bare.indexOf('Puell / miner-reserve / hash-ribbon inputs not fetched') >= 0, 'miner cycle is UNREAD without its inputs');
  ok(bare.indexOf('Stablecoin cadence') >= 0 && bare.indexOf('supply deltas not fetched') >= 0, 'stablecoin cadence is UNREAD without its inputs');
  ok(bare.indexOf('Exchange netflow') >= 0 && bare.indexOf('no 7-day flow series') >= 0, 'netflow is UNREAD without a flow series');
  const fed = W.hgObtcCycleContextHtml({ onchain: { puellMultiple: 0.4, stableTotalUsd: 1.6e11, stableDelta7dUsd: -1e9, stableDelta30dUsd: -4e9, stableContractingDays: 20 } },
    { pick: { row: { perfectReads: { netflowZ: 2.4, onchainVeto: true } } } });
  ok(fed.indexOf('CYCLE BOTTOM ACCUMULATION') >= 0, 'Puell 0.4 reads cycle-bottom accumulation');
  ok(fed.indexOf('contracting') >= 0 && fed.indexOf('14d+ contraction') >= 0, 'stablecoin 30d contraction reads with its days');
  ok(fed.indexOf('netflow z 2.4σ') >= 0 && fed.indexOf('distribution/squeeze veto') >= 0, 'the A6 netflow z and its veto print');
}

console.log('== 5) the real scan: new legs read, marks ride the record ==');
{
  const cap = {};
  const W = boot(scanStubs(cap, TREND));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  const stat = await W.hgObtcRunScan(ui);
  ok(/MOST PROBABLE/.test(stat), 'the scan crowns: ' + stat);
  const rec = cap.rec && cap.rec.rows && cap.rec.rows[0];
  ok(rec && rec.leverageState === 'RESET', 'OI -12% reads RESET and rides the record');
  ok(rec && rec.cvdContext === 'BOTH-WITH', 'spot + perp taker series both rising reads BOTH-WITH for the long');
  ok(rec && rec.basisMom === 'ACCEL', 'the basis crossing above zero reads ACCEL');
  ok(rec && rec.trendQuality === 'TREND', 'the clean-trend tape reads TREND');
  ok(rec && rec.flowAbsorbed === true, 'flow against + three advancing closes stamps absorption');
  ok(rec && rec.perfect === true && rec.perfectPlus !== true, 'PERFECT holds, PERFECT+ does not (the absorbed flow is readable but not with)');
  ok(rec && rec.liqClusterUsd === 52300000 && rec.liqFuelUsd === 17000000, 'the USD figures off the liquidation rows ride the record');
  ok(rec && rec.session === 'LONDON', 'the session mark rides the record (LAST_T hour 8 = LONDON)');
  const d = ui.detail.innerHTML;
  ok(d.indexOf('CYCLE CONTEXT') >= 0 && d.indexOf('never faked') >= 0, 'the cycle context panel prints beside the pick');
  ok(d.indexOf('Leverage cycle') >= 0 && d.indexOf('RESET') >= 0, 'the leverage witness row prints with the state');
  ok(d.indexOf('Trend quality') >= 0 && d.indexOf('TREND') >= 0, 'the trend-quality witness row prints');
  ok(d.indexOf('Spot vs perp flow') >= 0 && d.indexOf('spot and perp both with the trade') >= 0, 'the spot-vs-perp witness row prints');
  ok(d.indexOf('Basis momentum') >= 0 && d.indexOf('ACCELERATING') >= 0, 'the basis-momentum witness row prints');
  ok(d.indexOf('Flow absorption') >= 0 && d.indexOf('absorption, not distribution') >= 0, 'the absorption witness row prints');
  ok(d.indexOf('$52.3M') >= 0 && d.indexOf('$17M') >= 0, 'the liquidation magnitudes print in dollars');
}

console.log('== 6) CHOP vetoes in situ, and every new leg fails open when its feed is absent ==');
{
  const cap = {};
  const W = boot(scanStubs(cap, CHOP));
  const ui = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  await W.hgObtcRunScan(ui);
  const rec = cap.rec && cap.rec.rows && cap.rec.rows[0];
  ok(rec && rec.trendQuality === 'CHOP', 'the choppy tape reads CHOP');
  ok(rec && rec.perfect !== true, 'and CHOP vetoes PERFECT in situ — the crown still records, it just earns no badge');
  ok(ui.detail.innerHTML.indexOf('Trend quality') >= 0 && ui.detail.innerHTML.indexOf('CHOP') >= 0, 'the CHOP witness row prints beside the pick');
  /* fail-open: strip every accuracy feed — the scan must still crown */
  const cap2 = {};
  const stubs2 = scanStubs(cap2, TREND);
  delete stubs2.coinalyzeOIChg; delete stubs2.binanceFundingHist; delete stubs2.binanceSpotTakerFlow; delete stubs2.binanceBasis;
  const W2 = boot(stubs2);
  const ui2 = { btn: mk(), stat: mk(), cards: mk(), detail: mk(), fwd: mk(), ind: mk(), ledger: mk() };
  const stat2 = await W2.hgObtcRunScan(ui2);
  ok(/MOST PROBABLE/.test(stat2), 'the scan crowns with every accuracy feed absent: ' + stat2);
  const rec2 = cap2.rec && cap2.rec.rows && cap2.rec.rows[0];
  ok(rec2 && rec2.leverageState === undefined && rec2.cvdContext === undefined && rec2.basisMom === undefined,
    'absent feeds leave the marks undefined — unreadable is not a verdict');
}

console.log('== 7) textual pins: the record literal keeps its censused keys and carries the new marks ==');
{
  const src = read('omnibtc.js');
  const at = src.indexOf('var fwdRow = {');
  ok(at >= 0, 'the record literal exists');
  const lit = src.slice(at, src.indexOf('\n            };', at) + 1);
  ok(/fundingPct:\s*\(fwdTk/.test(lit), 'fundingPct stays INSIDE the record literal (the funding census reads it)');
  ok(/\bmark:\s*fwdLast/.test(lit), 'mark stays inside the record literal (the fill-mark census reads it)');
  ok(src.indexOf('var fwdRows = [fwdRow];') >= 0, 'the named record array is untouched');
  for (const key of ['trendQuality', 'leverageState', 'flowAbsorbed', 'netflowZ', 'cvdContext', 'basisMom', 'liqClusterUsd', 'liqFuelUsd', 'session']){
    ok(new RegExp('\\b' + key + ':\\s*\\((?:isFinite\\()?pfReads\\.').test(lit), key + ' is a mark inside the record literal');
  }
  ok(/pfReads\.takerFlowVerdict = 'against-absorbed'/.test(src), 'the absorption downgrade is pinned at its site');
  ok(/pfReads\.leverageState = 'RESET'/.test(src) && /pfReads\.leverageState = 'EXTENDED'/.test(src), 'the leverage states are pinned at their site');
  const pf = read('hg-perfect-setup.js');
  ok(/trend-quality against/.test(pf) && /leverage extended/.test(pf) && /on-chain distribution\/squeeze veto/.test(pf) && /perp-only move/.test(pf), 'the four new predicate vetoes are pinned in hg-perfect-setup.js');
  ok(/flow === 'against'\)/.test(pf) && /against-absorbed/.test(pf), 'only the plain against vetoes — the absorption comment is pinned');
}

console.log('\ntest-omnibtc-accuracy-pack-v1057: ' + passed + ' passed, 0 failed');
