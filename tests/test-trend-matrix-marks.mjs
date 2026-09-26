/* HARDGATE -- hg-v995: THE TREND MATRIX COMPOSITE, READ THROUGH ONE HOME AND
   RECORDED BESIDE AN OUTCOME.

   trendtable.js scores five legs into a composite (-5..+5) and four consumers
   read it: the desk's own board, the PINE universe filter, the FTS setup
   stack and CONTRACT REPORT. None recorded it beside an outcome, and CONTRACT
   REPORT handed trendmxClassify two candle ARRAYS where it wants a scored row
   and a direction -- so that report row read idle, with no detail, on a tape
   the composite scores +5/5.

   The stance (with / against / neutral) lives once in trendtable.js, the
   report reads the desk's own published row through it, and the forward
   ledger records score, stance and snapshot age on every record. Nothing is
   gated on the marks. Node 18+, no network. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const text = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

function boot(files, extra){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} }, Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, TypeError, Set, Map, encodeURIComponent, setTimeout, clearTimeout, AbortController };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {}; s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }),
                 head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  s.__store = store;
  s.location = { href: 'https://x/', search: '', protocol: 'https:' }; s.navigator = { userAgent: 'node' }; s.fetch = async () => ({ ok: false, status: 500, text: async () => '' });
  if (extra) Object.assign(s, extra);
  vm.createContext(s);
  for (const f of files) vm.runInContext(read(f), s, { filename: f });
  return s;
}
/* a tape: n bars, `step` seconds apart, drifting `slope` per bar; slope 0 is flat */
function tape(n, step, slope, t0){
  const rows = []; let c = 100; const base = t0 || 1700000000;
  for (let i = 0; i < n; i++){ c += slope; rows.push({ t: base + i * step, o: c, h: c + 0.3, l: c - 0.3, c, v: 1000 }); }
  return rows;
}
const UP = { '4h': tape(300, 14400, 0.3), '1d': tape(300, 86400, 1), '1h': tape(300, 3600, 0.1) };
const DN = { '4h': tape(300, 14400, -0.3), '1d': tape(300, 86400, -1), '1h': tape(300, 3600, -0.1) };
const WEAK = { '4h': tape(300, 14400, 0.3), '1d': tape(300, 86400, 0), '1h': tape(300, 3600, 0.1) };   /* flat 1d, bull 4h cascade: composite +1 */
const ENGINE = ['indicators.js', 'indicators2.js', 'cryptogates.js', 'plans.js', 'hg-forward.js', 'trendtable.js', 'contract-report.js'];
/* the desk scanned three contracts: ETH +5, SOL -5, LTC +1 (short of the majority); BTC never scanned */
async function scanned(files){
  const S = boot(files || ENGINE);
  S.hgDeskLoadUniverse = async () => ({ items: [
    { sym: 'ETHUSDT', base: 'ETH', exchange: 'binance', fundingPct: 0.01, turnoverUsd: 1e8, mark: 190 },
    { sym: 'SOLUSDT', base: 'SOL', exchange: 'delta', fundingPct: 0.01, turnoverUsd: 1e8, mark: 190 },
    { sym: 'LTCUSDT', base: 'LTC', exchange: 'coindcx', fundingPct: 0.01, turnoverUsd: 1e8, mark: 190 },
    { sym: 'XAUUSDT', base: 'XAU', exchange: 'binance', fundingPct: 0.01, turnoverUsd: 1e8, mark: 4500 } ], rawLen: 4 });
  S.hgDeskFetchKlines = (it, tf) => Promise.resolve((it.sym === 'ETHUSDT' || it.sym === 'XAUUSDT' ? UP : it.sym === 'SOLUSDT' ? DN : WEAK)[tf]);
  await S.trendmxScan({ force: true });
  return S;
}

console.log('1. trendtable.js: the stance, one home, three states');
{
  const S = boot(['indicators.js', 'indicators2.js', 'trendtable.js']);
  const A = S.hgTrendMatrixAlign;
  ok(typeof A === 'function' && typeof S.hgTrendMatrixRowOf === 'function' && typeof S.hgTrendMatrixMark === 'function', 'hgTrendMatrixAlign, hgTrendMatrixRowOf and hgTrendMatrixMark are exported');
  ok(A(5, 'long') === 'with' && A(2, 'long') === 'with' && A(-2, 'short') === 'with' && A(-5, 'short') === 'with', 'a majority in the plan\'s direction reads WITH');
  ok(A(5, 'short') === 'against' && A(-2, 'long') === 'against' && A(-5, 'long') === 'against', 'a majority the other way reads AGAINST');
  ok(A(1, 'long') === 'neutral' && A(-1, 'long') === 'neutral' && A(0, 'short') === 'neutral' && A(1, 'short') === 'neutral', 'short of the majority either way reads NEUTRAL');
  ok(A('5', 'long') === undefined && A(NaN, 'long') === undefined && A(null, 'long') === undefined && A(undefined, 'short') === undefined, 'a string, NaN or null score is not a read (+null is 0, and 0 would be neutral)');
  ok(A(5, '') === undefined && A(5, 'flat') === undefined && A(5, null) === undefined && A(5, undefined) === undefined, 'no direction is no verdict, even at +5');
  ok(A(5, 'LONG') === 'with' && A(5, 'Short') === 'against', 'direction case is normalised');
  /* the bar is tmDirOf's bar and nothing else: over every integer composite and both directions,
     the stance equals the derivation from the desk's own majority reader */
  let agree = 0, total = 0;
  for (let sc = -5; sc <= 5; sc++) for (const d of ['long', 'short']){
    const maj = S.tmDirOf({ score: sc });
    const want = !maj ? 'neutral' : (maj === d ? 'with' : 'against');
    total++; if (A(sc, d) === want) agree++;
  }
  ok(agree === total && total === 22, 'the stance equals tmDirOf\'s majority on all ' + total + ' (score, dir) pairs -- one bar, not restated');
  ok(S.hgTrendMatrixRowOf('ETHUSDT') === null && S.trendmxState() === null, 'before any scan there is no row and no snapshot');
  const m0 = S.hgTrendMatrixMark('long', 'ETHUSDT');
  ok(m0.score === undefined && m0.align === undefined && m0.ageMin === undefined, 'and a mark before any scan is NOT RECORDED on every field');
}

console.log('2. the published row, matched on the base, and the mark at fire time');
{
  const S = await scanned();
  const st = S.trendmxState();
  ok(st && st.rows.length === 4 && st.rows[0].score === 5 && st.rows[1].score === -5 && st.rows[2].score === 1 && st.rows[3].score === 5, 'the fixture scans ETH +5, SOL -5, LTC +1 and the gold perp XAUUSDT +5 (' + st.rows.map(r => r.score).join('/') + ')');
  ok(st.rows[0].comps && st.rows[0].comps.d1Trend === 1 && st.rows[0].comps.cloud === 1, 'the snapshot rows carry the five components, so a consumer can name the evidence');
  ok(S.hgTrendMatrixRowOf('ETHUSDT').score === 5 && S.hgTrendMatrixRowOf('ETH-PERP').score === 5 && S.hgTrendMatrixRowOf('ETHUSD').score === 5 && S.hgTrendMatrixRowOf('ethusdt').score === 5 && S.hgTrendMatrixRowOf('ETH').score === 5, 'a contract is matched on its base under every spelling');
  ok(S.hgTrendMatrixRowOf('BTCUSDT') === null && S.hgTrendMatrixRowOf('') === null && S.hgTrendMatrixRowOf(null) === null, 'an unscanned contract, or no symbol, has no row');
  ok(S.hgTrendMatrixRowOf('WETHUSDT') === null, 'WETH is not ETH -- the base is matched whole, not by substring');
  const eL = S.hgTrendMatrixMark('long', 'ETH-PERP'), eS = S.hgTrendMatrixMark('short', 'ETHUSDT'), sL = S.hgTrendMatrixMark('long', 'SOLUSD'), lL = S.hgTrendMatrixMark('long', 'LTCUSDT');
  ok(eL.score === 5 && eL.align === 'with' && eS.score === 5 && eS.align === 'against', 'ETH +5: WITH a long, AGAINST a short');
  ok(sL.score === -5 && sL.align === 'against' && lL.score === 1 && lL.align === 'neutral', 'SOL -5 is AGAINST a long; LTC +1 is NEUTRAL');
  ok(eL.ageMin === 0, 'the snapshot age at fire is whole minutes (' + eL.ageMin + ' just after the scan)');
  const realDate = S.Date; const at = st.at;
  S.Date = { now: () => at + 30 * 60000 + 20000 };
  ok(S.hgTrendMatrixMark('long', 'ETHUSDT').ageMin === 30, 'thirty minutes later it reads 30');
  S.Date = realDate;
  const b = S.hgTrendMatrixMark('long', 'BTCUSDT');
  ok(b.score === undefined && b.align === undefined && b.ageMin === undefined, 'an unscanned contract records NOTHING -- not neutral, not zero');
  const g = S.hgTrendMatrixMark('long', 'XAUUSD');
  ok(S.hgTrendMatrixRowOf('XAUUSD') && S.hgTrendMatrixRowOf('XAUUSD').score === 5 && g.score === undefined && g.align === undefined, 'a gold-lane symbol gets nothing even though the desk scanned the gold PERP under the same base: this is a crypto trend desk, and XAUUSD records belong to the gold ledgers');
  const nd = S.hgTrendMatrixMark('', 'ETHUSDT');
  ok(nd.score === 5 && nd.align === undefined, 'no direction: the score is read, the stance is not');
}

console.log('3. CONTRACT REPORT reads the desk\'s row and says so; unscanned reads UNCHECKED, not idle');
{
  const S = await scanned();
  const tmRow = (sym, inp) => S.hgContractReportRun(Object.assign({ sym, rows4h: UP['4h'], rows1h: UP['1h'], rows15m: tape(300, 900, 0.05), ticker: { symbol: sym, fundingPct: 0.01 } }, inp || {}))
    .sections[0].rows.filter(r => r.name === 'TREND MATRIX')[0];
  const e = tmRow('ETHUSDT');
  ok(e.state === 'signal' && e.dir === 'long' && e.passed === 5 && e.total === 5, 'ETH: signal, long, 5/5');
  ok(/composite \+5\/5/.test(e.detail) && /1D above EMA200/.test(e.detail) && /4H cascade bull/.test(e.detail) && /ADX strength bull/.test(e.detail) && /TREND MATRIX scan row/.test(e.detail), 'and the detail names the composite, the legs, and where it came from');
  const s = tmRow('SOLUSDT');
  ok(s.state === 'signal' && s.dir === 'short' && /composite -5\/5/.test(s.detail) && /below cloud/.test(s.detail), 'SOL reads the DESK\'S row (short), not the report\'s own bull tape -- the composite needs daily bars this report never fetches');
  const l = tmRow('LTCUSDT');
  ok(l.state === 'idle' && l.dir === null && l.passed === 1 && /composite \+1\/5/.test(l.detail) && /short of the majority/.test(l.detail), 'LTC +1: idle, short of the majority, and the detail says so');
  const b = tmRow('BTCUSDT');
  ok(b.state === 'unchecked' && b.dir === null, 'an unscanned contract reads UNCHECKED, never idle (idle is a verdict, this is an absence)');
  ok(/TREND MATRIX has not scanned BTCUSDT/.test(b.detail) && /4h cascade alone reads bull/.test(b.detail) && /daily bars this report does not fetch/.test(b.detail), 'and names what could not be read and what the one leg in hand says');
  const tk = { fundingPct: 0.01 };
  const noSymTicker = S.hgContractReportRun({ sym: 'ETHUSDT', rows4h: UP['4h'], rows1h: UP['1h'], rows15m: tape(300, 900, 0.05), ticker: tk }).sections[0].rows.filter(r => r.name === 'TREND MATRIX')[0];
  ok(noSymTicker.state === 'signal' && noSymTicker.dir === 'long', 'a caller naming the symbol on the input and handing a ticker WITHOUT one still gets the row');
  ok(tk.symbol === undefined, 'and the caller\'s ticker is not written to');
  /* the defect, reproduced on the classifier the old row called: two arrays hand back nothing */
  const cl = S.trendmxClassify(UP['4h'], UP['1h']);
  ok(Array.isArray(cl.dir) && cl.longEv.length === 0 && cl.score === 0, 'the old call shape -- trendmxClassify(rows4h, rows1h) -- returns an array for a direction and no evidence, which is what every report printed');
  const src = read('contract-report.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/trendmxClassify\(rows4h/.test(src), 'the report no longer hands candle arrays to the classifier');
  /* with trendtable absent the row reads module not loaded, as every other engine does */
  const bare = boot(['indicators.js', 'indicators2.js', 'cryptogates.js', 'plans.js', 'contract-report.js']);
  const nb = bare.hgContractReportRun({ sym: 'ETHUSDT', rows4h: UP['4h'], rows1h: UP['1h'], rows15m: tape(300, 900, 0.05), ticker: { symbol: 'ETHUSDT' } }).sections[0].rows.filter(r => r.name === 'TREND MATRIX')[0];
  ok(nb.state === 'unchecked' && /module not loaded/.test(nb.detail) && /hgTrendMatrixRowOf/.test(nb.detail), 'trendtable.js absent: UNCHECKED, naming the missing home');
  /* nothing else on the report moves with the snapshot */
  const cold = boot(ENGINE);
  const strip = rep => rep.sections.filter(sec => sec.id !== 'measured').map(sec => sec.rows.filter(r => r.name !== 'TREND MATRIX').map(r => JSON.stringify(r)).join('|')).join('||');
  const inp = { sym: 'ETHUSDT', rows4h: UP['4h'], rows1h: UP['1h'], rows15m: tape(300, 900, 0.05), ticker: { symbol: 'ETHUSDT', fundingPct: 0.01 } };
  ok(strip(cold.hgContractReportRun(inp)) === strip(S.hgContractReportRun(inp)), 'every other engine row of the report is byte-identical with and without a TREND MATRIX scan');
  /* the second dead read: a firing TREND MATRIX row sends the measured section to the desk's forward pool,
     and the table named 'TRENDTABLE' -- a pool nothing writes. It names TRENDMX now, and reads what is there. */
  const measured = rep => rep.sections.filter(sec => sec.id === 'measured')[0].rows.map(r => r.name + ' :: ' + r.state + ' :: ' + r.detail).join(' | ');
  ok(/Forward log · TRENDMX :: idle :: no settled out-of-sample trades recorded/.test(measured(S.hgContractReportRun(inp))), 'with TREND MATRIX firing and the pool empty, the measured section names the TRENDMX pool and says it is empty');
  ok(!/TRENDTABLE/.test(read('contract-report.js').replace(/\/\*[\s\S]*?\*\//g, '')), 'the pool nothing writes is named nowhere in the report\'s code (the comment recording the defect aside)');
  S.hgFwdRecordScan('TRENDMX', '4h', [{ sym: 'ETHUSDT', dir: 'long', entry: 100, stop: 95, t1: 110, barT: 1700000000, mechanic: 'TM-CLEAN7', ticket: true }], { horizonBars: 20 });
  S.hgFwdResolve('ETHUSDT', '4h', [{ t: 1700014400, o: 100, h: 111, l: 99, c: 110, v: 1 }]);
  ok(/Forward log · TRENDMX :: signal :: 1 settled · hit 100\.0%/.test(measured(S.hgContractReportRun(inp))), 'and once the desk has a settled record the report reads it (the old name would have read empty forever)');
}

console.log('4. the ledger records score, stance and age; desk hand-ins win field by field; junk is never coerced');
{
  const S = await scanned();
  const row = (sym, dir, extra) => Object.assign({ sym, dir, entry: 100, stop: dir === 'long' ? 95 : 105, t1: dir === 'long' ? 110 : 90 }, extra || {});
  S.hgFwdRecordScan('T', '4h', [
    row('ETHUSDT', 'long'), row('SOLUSDT', 'long'), row('LTCUSDT', 'short'), row('BTCUSDT', 'long'), row('XAUUSD', 'long'),
    /* desk hand-ins that DISAGREE with the shared read, so ignoring or coercing them is visible */
    row('ETH-PERP', 'long', { tmScore: -4 }),                       /* the desk says -4 where the snapshot says +5 */
    row('SOLUSD', 'long', { tmAlign: 'neutral' }),                  /* partial: the stance only; score and age from the shared read */
    row('AAAUSDT', 'long', { tmScore: 3, tmAlign: 'with', tmAgeMin: 7 }),   /* a contract the desk never scanned, fully handed in */
    row('BBBUSDT', 'short', { tmScore: '5', tmAlign: 'WITH', tmAgeMin: -3 }),   /* junk, on a contract with no shared read: NOT RECORDED */
    row('ETHUSD', 'short', { tmScore: 'yes', tmAlign: 1 })          /* junk, on a contract the shared read knows: the shared read decides */
  ], { horizonBars: 20 });
  const by = {}; S.hgFwdRecords('T').forEach(x => { by[x.sym] = x; });
  ok(Object.keys(by).length === 10, 'ten records written (' + Object.keys(by).length + ')');
  ok(by.ETHUSDT.tmScore === 5 && by.ETHUSDT.tmAlign === 'with' && by.ETHUSDT.tmAgeMin === 0, 'ETH long: +5, WITH, age 0 from the shared read');
  ok(by.SOLUSDT.tmScore === -5 && by.SOLUSDT.tmAlign === 'against', 'SOL long: -5, AGAINST');
  ok(by.LTCUSDT.tmScore === 1 && by.LTCUSDT.tmAlign === 'neutral', 'LTC short: +1, NEUTRAL');
  ok(by.BTCUSDT.tmScore === undefined && by.BTCUSDT.tmAlign === undefined && by.BTCUSDT.tmAgeMin === undefined, 'an unscanned contract records NOT RECORDED on all three');
  ok(by.XAUUSD.tmScore === undefined && by.XAUUSD.tmAlign === undefined, 'a gold record carries no crypto trend mark');
  ok(by['ETH-PERP'].tmScore === -4 && by['ETH-PERP'].tmAlign === 'against' && by['ETH-PERP'].tmAgeMin === 0, 'a desk score wins, the stance is derived from THAT score through the one rule (-4 long = AGAINST), the age from the shared snapshot');
  ok(by.SOLUSD.tmAlign === 'neutral' && by.SOLUSD.tmScore === -5, 'a partial hand-in keeps the field it named and takes the rest from the shared read');
  ok(by.AAAUSDT.tmScore === 3 && by.AAAUSDT.tmAlign === 'with' && by.AAAUSDT.tmAgeMin === 7, 'a full hand-in on an unscanned contract is recorded as handed');
  ok(by.BBBUSDT.tmScore === undefined && by.BBBUSDT.tmAlign === undefined && by.BBBUSDT.tmAgeMin === undefined, 'junk on an unscanned contract: NOT RECORDED, never coerced (\'5\' is not 5, -3 is not an age)');
  ok(by.ETHUSD.tmScore === 5 && by.ETHUSD.tmAlign === 'against', 'junk beside a shared read: the shared read decides (a short against +5 is AGAINST)');
  /* the direct door refuses the same junk and accepts the READ zero */
  S.hgFwdRecord({ tab: 'D', mechanic: 'x', sym: 'CUSDT', tf: '4h', dir: 'long', entry: 100, stop: 95, t1: 110, barT: 1700000000, horizonBars: 20, tmScore: 7, tmAlign: 'bull', tmAgeMin: -1 });
  S.hgFwdRecord({ tab: 'D', mechanic: 'x', sym: 'DUSDT', tf: '4h', dir: 'long', entry: 100, stop: 95, t1: 110, barT: 1700000000, horizonBars: 20, tmScore: '3', tmAlign: 'WITH', tmAgeMin: '4' });
  S.hgFwdRecord({ tab: 'D', mechanic: 'x', sym: 'EUSDT', tf: '4h', dir: 'long', entry: 100, stop: 95, t1: 110, barT: 1700000000, horizonBars: 20, tmScore: 0, tmAlign: 'neutral', tmAgeMin: 0 });
  S.hgFwdRecord({ tab: 'D', mechanic: 'x', sym: 'FUSDT', tf: '4h', dir: 'long', entry: 100, stop: 95, t1: 110, barT: 1700000000, horizonBars: 20, tmScore: -5, tmAlign: 'against', tmAgeMin: 12 });
  const d = {}; S.hgFwdRecords('D').forEach(x => { d[x.sym] = x; });
  ok(d.CUSDT.tmScore === undefined && d.CUSDT.tmAlign === undefined && d.CUSDT.tmAgeMin === undefined, 'direct door: 7 is outside the five-leg range, \'bull\' is not a stance, -1 is not an age');
  ok(d.DUSDT.tmScore === undefined && d.DUSDT.tmAlign === undefined && d.DUSDT.tmAgeMin === undefined, 'direct door: string numbers and an upper-case stance are refused');
  ok(d.EUSDT.tmScore === 0 && d.EUSDT.tmAlign === 'neutral' && d.EUSDT.tmAgeMin === 0, 'a score of exactly zero and an age of exactly zero are READ zeros');
  ok(d.FUSDT.tmScore === -5 && d.FUSDT.tmAlign === 'against' && d.FUSDT.tmAgeMin === 12, 'valid values survive the direct door');
  ok(S.hgFwdTrendMatrixSplitHtml('NONE') === '', 'a desk with no records prints nothing');
}

console.log('5. settled, split, folded, printed -- and nothing where no record carries a mark');
{
  const S = await scanned();
  const row = (sym, dir, extra) => Object.assign({ sym, dir, entry: 100, stop: dir === 'long' ? 95 : 105, t1: dir === 'long' ? 110 : 90, barT: 1700000000 }, extra || {});
  const realDate = S.Date; S.Date = { now: () => S.trendmxState().at + 30 * 60000 + 5000 };   /* every record fires 30 min after the scan */
  S.hgFwdRecordScan('T', '4h', [
    row('ETHUSDT', 'long'),                       /* with, wins */
    row('ETH-PERP', 'long', { tmScore: 4 }),      /* with, loses */
    row('ETHUSD', 'long'),                        /* with, wins */
    row('SOLUSDT', 'long'),                       /* against, loses */
    row('SOLUSD', 'long', { tmScore: -3 }),       /* against, wins */
    row('LTCUSDT', 'long'),                       /* neutral, wins */
    row('BTCUSDT', 'long'),                       /* unmarked, wins */
    row('XAUUSD', 'long'),                        /* unmarked (gold), loses */
    row('AAAUSDT', 'short', { tmScore: 2 })       /* against, stays OPEN: folds nothing */
  ], { horizonBars: 20 });
  S.Date = realDate;
  const win = [{ t: 1700014400, o: 100, h: 111, l: 99, c: 110, v: 1 }], lose = [{ t: 1700014400, o: 100, h: 101, l: 94, c: 95, v: 1 }];
  S.hgFwdResolve('ETHUSDT', '4h', win); S.hgFwdResolve('ETH-PERP', '4h', lose); S.hgFwdResolve('ETHUSD', '4h', win); S.hgFwdResolve('SOLUSDT', '4h', lose); S.hgFwdResolve('SOLUSD', '4h', win);
  S.hgFwdResolve('LTCUSDT', '4h', win); S.hgFwdResolve('BTCUSDT', '4h', win); S.hgFwdResolve('XAUUSD', '4h', lose);
  const sp = S.hgFwdTrendMatrixSplit('T');
  ok(sp && sp.settled === 8 && sp.marked === 6 && sp.unmarked === 2, 'eight settled: six marked, two NEITHER (' + JSON.stringify([sp.settled, sp.marked, sp.unmarked]) + ')');
  ok(sp.cells.with.n === 3 && sp.cells.with.wins === 2 && sp.cells.against.n === 2 && sp.cells.against.wins === 1 && sp.cells.neutral.n === 1 && sp.cells.neutral.wins === 1, 'cells: with 2/3, against 1/2, neutral 1/1');
  ok(Math.abs(sp.cells.with.r - 1) < 1e-9 && Math.abs(sp.cells.against.r - 0.5) < 1e-9 && sp.cells.neutral.r === 2, 'R per cell: two 2R wins and a -1R loss average +1.000R; a 2R win and a -1R loss +0.500R; the neutral cell reads its one win');
  ok(sp.ageMedianMin === 30, 'the median snapshot age at fire is 30 minutes');
  const h = text(S.hgFwdTrendMatrixSplitHtml('T'));
  ok(/TREND MATRIX SPLIT/.test(h) && /2 of 6 marked settled records fired with the five-leg composite AGAINST them/.test(h), 'the panel line leads with the against count');
  ok(/against \+0\.500R at 50% on n=2/.test(h) && /with \+1\.000R at 67% on n=3/.test(h) && /neutral \+2\.000R at 100% on n=1/.test(h), 'and prints every cell');
  ok(/median snapshot age at fire 30 min/.test(h) && /2 carry no mark and are counted as NEITHER/.test(h) && /Reported, not gated/.test(h), 'age, NEITHER and the reported-not-gated line');
  const fold = S.hgFwdFold({}, S.hgFwdRecords('T'))['T|4h'];
  ok(fold && fold.tm && fold.tm.with.wins === 2 && fold.tm.with.losses === 1 && fold.tm.against.wins === 1 && fold.tm.against.losses === 1 && fold.tm.neutral.wins === 1 && !fold.tm.neutral.losses, 'the fold carries a bucket per stance');
  const tot = ['with', 'against', 'neutral'].reduce((a, k) => a + fold.tm[k].wins + fold.tm[k].losses + (fold.tm[k].expired || 0), 0);
  ok(tot === 6, 'the open record folds nothing: six marked settled records, six folded (' + tot + ')');
  const shared = S.hgFwdPanelHTML ? text(S.hgFwdPanelHTML('T')) : '';
  ok(/TREND MATRIX SPLIT/.test(shared), 'the shared forward panel carries the line');
  /* the folded tail is read back once the live records are gone (the live cap prunes them) */
  S.__store['hg_forward_agg_v1'] = JSON.stringify(S.hgFwdFold({}, S.hgFwdRecords('T')));
  delete S.__store['hg_forward_v1'];
  const spA = S.hgFwdTrendMatrixSplit('T');
  ok(spA.marked === 0 && spA.agg && spA.agg.with.wins === 2 && spA.agg.with.losses === 1 && spA.agg.against.wins === 1 && spA.agg.neutral.wins === 1, 'with no live record left, the split reads the folded buckets');
  const hA = text(S.hgFwdTrendMatrixSplitHtml('T'));
  ok(/folded beyond the live cap: with 2W\/1L, against 1W\/1L, neutral 1W\/0L/.test(hA), 'and the panel prints the folded tail');
  /* nothing where no record carries a mark */
  const S2 = boot(ENGINE);
  S2.hgFwdRecordScan('U', '4h', [row('BTCUSDT', 'long'), row('ETHUSDT', 'short')], { horizonBars: 20 });
  S2.hgFwdResolve('BTCUSDT', '4h', win); S2.hgFwdResolve('ETHUSDT', '4h', win);   /* the short is stopped by the same bar */
  const sp2 = S2.hgFwdTrendMatrixSplit('U');
  ok(sp2.settled === 2 && sp2.marked === 0 && sp2.unmarked === 2 && S2.hgFwdTrendMatrixSplitHtml('U') === '', 'a desk whose records carry no mark (TREND MATRIX never scanned) prints NOTHING -- an empty split is not a clean bill');
}

console.log('6. the TREND MATRIX desk\'s own records carry its composite, through the real tab (read off its published snapshot, handed in nowhere)');
{
  const S = boot(['indicators.js', 'indicators2.js', 'setup-stack.js', 'desk-scan-universe.js', 'hg-forward.js', 'trendtable.js']);
  const now = Math.floor(Date.now() / 1000);
  const mkRows = (closes, sec) => { const rows = []; let prev = closes[0]; const t0 = Math.floor(now / sec) * sec - closes.length * sec; for (let i = 0; i < closes.length; i++){ const c = closes[i], o = prev; rows.push({ t: t0 + i * sec, o, h: Math.max(o, c) + 0.3, l: Math.min(o, c) - 0.3, c, v: 1000 }); prev = c; } return rows; };
  const lin = (n, a, st) => { const r = []; for (let i = 0; i < n; i++) r.push(a + i * st); return r; };
  S.binancePerpUniverse = async () => ['AAAUSDT', 'BBBUSDT']; S.binanceTickers24h = async () => ({ AAAUSDT: { turnoverUsd: 50e6 }, BBBUSDT: { turnoverUsd: 30e6 } });
  const rows1d = mkRows(lin(260, 100, 1), 86400), rows4h = mkRows(lin(120, 50, 0.5), 14400);
  S.binanceKlines = async (sym, tf) => tf === '1d' ? rows1d : rows4h; S.toTrade = () => {};
  const mk = () => ({ innerHTML: '', textContent: '', className: '', disabled: false, style: {}, firstElementChild: { style: {} }, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } }, querySelector(){ return mk(); }, querySelectorAll(){ return []; }, addEventListener(ev, fn){ this._handler = fn; } });
  const tab = S.HG_tabs.filter(t => t.id === 'trendmx')[0]; const nodes = {};
  const el = { innerHTML: '', querySelector(sel){ if (!nodes[sel]) nodes[sel] = mk(); return nodes[sel]; }, querySelectorAll(){ return []; } };
  tab.mount(el); nodes['[data-r="run"]']._handler();
  const t0 = Date.now();
  while (Date.now() - t0 < 8000){ const t = nodes['[data-r="status"]'].textContent || ''; if (t.indexOf('scanned') > -1 || t.indexOf('Scan failed') > -1) break; await new Promise(r => setTimeout(r, 25)); }
  const recs = S.hgFwdRecords('TRENDMX');
  ok(recs.length >= 1, 'the real scan wrote ' + recs.length + ' TRENDMX record(s)');
  const snapRows = S.trendmxState().rows;
  ok(recs.every(r => typeof r.tmScore === 'number' && snapRows.some(sr => sr.sym === r.sym && sr.score === r.tmScore)), 'every record carries the composite of its own row on the board');
  ok(!/tmScore\s*:/.test(read('trendtable.js').replace(/\/\*[\s\S]*?\*\//g, '')), 'and the desk hands nothing in: the same number twice would be a second copy of the snapshot');
  ok(recs.every(r => r.tmAlign === 'with'), 'and a plan this desk mints is always WITH its own majority (' + recs.map(r => r.tmAlign).join(',') + ')');
  ok(recs.every(r => r.tmAgeMin === 0), 'recorded at the scan that produced the row: age 0');
}

console.log('6b. the FTS setup stack reads the stance through the one home');
{
  const S = boot(['indicators.js', 'indicators2.js', 'cryptogates.js', 'plans.js', 'setup-stack.js', 'trendtable.js']);
  const items = out => out.fundamental.items.filter(it => it.label === 'Trend matrix');
  const snap = { at: Date.now(), rows: [{ sym: 'ETHUSDT', score: 5, dir: 'long' }, { sym: 'SOLUSDT', score: -2, dir: 'short' }, { sym: 'LTCUSDT', score: 1, dir: null }, { sym: 'ADAUSDT', score: 3, dir: 'long' }] };
  let out = S.hgSetupStack({ dir: 'long', sym: 'ETHUSDT', asset: 'crypto', trendmx: snap });
  ok(items(out).length === 1 && items(out)[0].align === 'with' && items(out)[0].detail === 'composite +5/5 STRONG', 'ETH +5 on a long: with, STRONG (the stack\'s own tier at |4|)');
  out = S.hgSetupStack({ dir: 'long', sym: 'ADAUSDT', asset: 'crypto', trendmx: snap });
  ok(items(out).length === 1 && items(out)[0].detail === 'composite +3/5', 'ADA +3 on a long: with, not STRONG');
  out = S.hgSetupStack({ dir: 'short', sym: 'SOLUSDT', asset: 'crypto', trendmx: snap });
  ok(items(out).length === 1 && items(out)[0].detail === 'composite -2/5' && items(out)[0].align === 'with', 'SOL -2 on a short: with, exactly at the majority');
  out = S.hgSetupStack({ dir: 'long', sym: 'SOLUSDT', asset: 'crypto', trendmx: snap });
  ok(items(out).length === 0, 'SOL -2 on a long: AGAINST bumps nothing (no against-item is invented here)');
  out = S.hgSetupStack({ dir: 'long', sym: 'LTCUSDT', asset: 'crypto', trendmx: snap });
  ok(items(out).length === 0, 'LTC +1 on a long: neutral bumps nothing');
  out = S.hgSetupStack({ dir: 'long', sym: 'ETHUSDT', asset: 'crypto', trendmx: { at: Date.now(), rows: [{ sym: 'ETHUSDT', score: '5', dir: 'long' }] } });
  ok(items(out).length === 0, 'a string score is not a read: nothing is bumped (+\'5\' is not 5 here)');
  const S0 = boot(['indicators.js', 'indicators2.js', 'cryptogates.js', 'plans.js', 'setup-stack.js']);
  out = S0.hgSetupStack({ dir: 'long', sym: 'ETHUSDT', asset: 'crypto', trendmx: snap });
  ok(items(out).length === 0, 'with the one home absent nothing is bumped rather than a second copy of the bar applied');
  const ss = read('setup-stack.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/tsc >= 2|tsc <= -2/.test(ss), 'the |2| bar is no longer restated in setup-stack.js (textual)');
}

console.log('7. nothing is gated on the marks');
{
  const gateFiles = ['engine.js', 'cryptogates.js', 'hg-gates.js', 'plans.js', 'pinegate.js', 'setup-stack.js', 'brain.js', 'startradertab.js', 'omniroute.js', 'omnipresent.js', 'hg-setup-core.js', 'contract-report.js', 'trendtable.js'];
  const hits = gateFiles.filter(f => fs.existsSync(path.join(root, f)) && /\btm(Align|Score|AgeMin)\b/.test(read(f).replace(/\/\*[\s\S]*?\*\//g, '')));
  ok(hits.length === 0, 'no gate module or desk reads tmAlign / tmScore / tmAgeMin (' + (hits.join(',') || 'none') + ')');
  const fwd = read('hg-forward.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok((fwd.match(/hgTrendMatrixMark\(/g) || []).length === 1 && (fwd.match(/hgTrendMatrixAlign\(/g) || []).length === 1, 'the ledger reads the mark and the stance through one call each');
  const tm = read('trendtable.js').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/hgFwdRecords\(|hgFwdTrendMatrixSplit/.test(tm), 'the desk reads nothing back from the ledger');
}

console.log('8. version stamps');
{
  const v = (read('build-stamp.js').match(/version:\s*'(hg-v\d+)'/) || [])[1];
  ok(v && parseInt(v.slice(4), 10) >= 995, 'build-stamp.js at or past hg-v995 (' + v + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
}

console.log('\n' + passed + ' assertions passed');
