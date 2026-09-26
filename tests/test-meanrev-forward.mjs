/* hg-v997 — MEAN REV PRINTED SEND TO TRADE PLAN AND ADD TO BOOK ON EVERY
   LEVELLED CARD, AND WROTE NO FORWARD RECORD OF ANY KIND.

   The only record on a MEAN REV card was the in-sample SETUP RECORD:
   mrBacktest on the same bars the signal reads, sorted by, and never asked
   out of sample whether it predicts anything. meanrev.js had no reference to
   hg-forward at all (the hg-v991 STAR TRADER shape: a desk that never called
   the ledger was invisible to the census that counts callers), and CONTRACT
   REPORT looked this desk's forward log up under 'MEANREV' -- a pool nothing
   wrote, named as such in hg-v995 and left. Five consumers read mrSignal
   (OMNIBTC, STAR TRADER, REVERSAL SNIPER, CONTRACT REPORT, OMNIROUTE) and
   none could say what the signal is worth forward.

   This pack: every levelled plan the scan forms is recorded under MEANREV --
   dated on the last CLOSED 4h bar the desk read (mrClosed at the fetch site),
   carrying the mark, the venue funding the desk item had, the replay's own
   MAX_HOLD as horizon, and three hg-v989 read marks (record:positive,
   context:adverse, omni:demoted; each ABSENT when its layer did not speak).
   The levels recorded are the levels the two handoff buttons book, through
   one home (mrTradedPlan) the card now reads too. Open records settle on the
   bars each scan fetches, every symbol, before that bar's plans are recorded;
   the shared forward panel paints under the cards; CONTRACT REPORT's MEANREV
   pool reads a settled record where it read nothing forever. Nothing is gated
   on any of it: the scan reads nothing back from the ledger.

   Run: node tests/test-meanrev-forward.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = src => String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function boot(files, extra){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} }, Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, TypeError, Set, Map, encodeURIComponent, setTimeout, clearTimeout };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {}; s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }), head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  s.__store = store;
  s.location = { href: 'https://x/', search: '', protocol: 'https:' }; s.navigator = { userAgent: 'node' }; s.fetch = async () => ({ ok: true, json: async () => ({}) });
  if (extra) Object.assign(s, extra);
  vm.createContext(s);
  for (const f of files) vm.runInContext(read(f), s, { filename: f });
  const warns = []; const rw = s.hgFwdWarn; s.hgFwdWarn = function(a, e){ warns.push(a + ': ' + (e && e.message || e)); return rw && rw.apply(this, arguments); }; s.__warns = warns;
  return s;
}
const STACK = ['indicators.js', 'indicators2.js', 'hg-forward.js', 'meanrev.js'];
const SEC = 14400;
const now = Date.now() / 1000;
const CLOCK = Math.floor(now / SEC) * SEC;          /* the bar still forming */
const LAST = CLOCK - SEC;                           /* the last closed 4h bar */
/* the LONG fixture the desk's own test uses: flat 100 x190, plateau 104 x17,
   dip 103.4 / 102.9 / 102.5 -> close > sma200, rsi2 ~ 0, %B < 0 */
const LONG_CLOSES = [...Array(190).fill(100), ...Array(17).fill(104), 103.4, 102.9, 102.5];
const mk = (closes, endT) => closes.map((c, i) => ({ t: endT - (closes.length - 1 - i) * SEC, o: c, h: c + 0.5, l: c - 0.5, c, v: 1000 }));
const mkEl = () => ({ innerHTML: '', textContent: '', disabled: false, style: {}, className: '', firstElementChild: { style: {} }, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } }, _qs: {}, _hs: {}, addEventListener(ev, fn){ this._hs[ev] = fn; }, appendChild(){}, querySelector(sel){ if (!this._qs[sel]) this._qs[sel] = mkEl(); return this._qs[sel]; }, querySelectorAll(){ return []; } });
const settle = async (btn) => { for (let i = 0; i < 800; i++){ if (!btn.disabled) return true; await new Promise(r => setTimeout(r, 5)); } return false; };

console.log('1. the read marks: three states, each layer absent when it did not speak');
{
  const S = boot(STACK);
  const rd = r => S.mrFwdRows([r]).length ? S.mrFwdRows([r])[0].reads : 'no-row';
  const rows = mk(LONG_CLOSES, LAST);
  const sig = S.mrSignal(rows);
  ok(sig && sig.dir === 'long', 'REACHABILITY: the fixture fires a long');
  const base = (over) => Object.assign({ sym: 'BTCUSDT', sig, rows, tick: { mark: 102.5 }, bt: { n: 0, expR: 0 },
    stats: { extreme: 102.0, atr: 0.8, oppBand: 104.5, last: 102.5 } }, over || {});
  ok(Object.keys(rd(base())).length === 0, 'no record, no context, no principal layer: the reads object is EMPTY (the ledger will record no reads)');
  ok(rd(base({ bt: { n: 5, expR: 0.31 } }))['record:positive'] === true, 'a SETUP RECORD at or over MIN_RECORD with expectancy > 0 reads record:positive true');
  ok(rd(base({ bt: { n: 5, expR: -0.2 } }))['record:positive'] === false, '... and one at or under zero reads false');
  ok(rd(base({ bt: { n: 5, expR: 0 } }))['record:positive'] === false, 'exactly zero expectancy is NOT positive');
  ok(rd(base({ bt: { n: 2, expR: 0.9 } }))['record:positive'] === undefined, 'a THIN record (under MIN_RECORD) marks nothing -- absent, not false');
  ok(rd(base({ bt: { n: '5', expR: 0.5 } }))['record:positive'] === undefined && rd(base({ bt: { n: 5, expR: '0.5' } }))['record:positive'] === undefined, 'a string n or expectancy is not a read (never coerced)');
  ok(rd(base({ contextRead: 'against 6/20', contextAdverse: true }))['context:adverse'] === true, 'the shared context ran and called it AGAINST: true');
  ok(rd(base({ contextRead: 'ok 2/20', contextAdverse: false }))['context:adverse'] === false, '... ran and did not: false');
  ok(rd(base({ contextRead: null, contextAdverse: true }))['context:adverse'] === undefined, 'no context read -> absent, whatever the adverse flag says');
  ok(rd(base({ omniDemoted: true }))['omni:demoted'] === undefined, 'with no OMNI principal layer loaded, omni:demoted is ABSENT even on a row stamped demoted');
  S.hgOmniPrincipalApply = () => {};
  ok(rd(base({ omniDemoted: true }))['omni:demoted'] === true && rd(base())['omni:demoted'] === false, 'with the layer loaded: true when the day book stood aside, false otherwise');
}

console.log('\n2. the rows the desk hands the ledger are the levels the card books');
{
  const S = boot(STACK);
  const rows = mk(LONG_CLOSES, LAST);
  const sig = S.mrSignal(rows);
  const st = { extreme: 102.0, atr: 0.8, oppBand: 104.5, last: 102.5, rsi2: 1, pctB: -0.1, vsSma200Pct: 1 };
  const r = { sym: 'BTCUSDT', sig, rows, tick: { mark: 102.5, turnoverUsd: 1e9 }, bt: { n: 0, expR: 0 }, stats: st, fundingPct: 0.021 };
  const out = S.mrFwdRows([r]);
  ok(out.length === 1, 'one levelled row -> one record row');
  const lv = S.mrTradedPlan(r);
  ok(lv && out[0].entry === lv.entry && out[0].stop === lv.stop && out[0].t1 === lv.t1, 'entry / stop / T1 are mrTradedPlan\'s -- the one home');
  /* the card's own handoff books the same numbers: capture what SEND TO TRADE PLAN is handed */
  let handed = null;
  S.hgToTradePlanOnclickAttr = (sym, dir, entry, stop, t1) => { handed = { sym, dir, entry, stop, t1 }; return 'x'; };
  const tab = S.HG_tabs.find(t => t.id === 'meanrev');
  ok(tab, 'REACHABILITY: the tab is registered');
  /* cardHTML is module-private; drive it through the real scan below (section 3 asserts the handoff) */
  ok(out[0].mark === 102.5 && out[0].barT === rows[rows.length - 1].t, 'mark = the decision bar\'s close (tick.mark), barT = the last closed row\'s time');
  ok(out[0].fundingPct === 0.021 && out[0].mechanic === 'MEANREV-RSI2' && out[0].ticket === true && out[0].dir === 'long' && out[0].sym === 'BTCUSDT', 'funding, mechanic, ticket, dir and sym ride');
  const junk = S.mrFwdRows([Object.assign({}, r, { rows: rows.map(x => Object.assign({}, x, { t: '', c: null })), fundingPct: null })])[0];
  ok(junk && junk.mark === undefined && junk.barT === undefined && junk.fundingPct === undefined, 'a null close, string times and a null funding read ABSENT, never zero (+null is 0)');
  ok(S.mrFwdRows([Object.assign({}, r, { rows: null })])[0].mark === undefined && S.mrFwdRows([Object.assign({}, r, { rows: null })])[0].barT === undefined, 'no series at all: mark and bar absent, the row still recorded');
  S.hgStrategyRefine = (lv0) => Object.assign({}, lv0, { stop: NaN });
  ok(S.mrFwdRows([r]).length === 0, 'a plan the refine layer hands back with a NaN stop is SKIPPED, never recorded with NaN levels');
  delete S.hgStrategyRefine;
  ok(S.mrFwdRows([null, {}, { sym: 'X' }, { sig }]).length === 0 && S.mrFwdRows(null).length === 0 && S.mrFwdRows('rows').length === 0, 'garbage rows and garbage input record nothing and never throw');
  /* refine is part of the traded plan: when the layer is loaded, the record moves with the card */
  S.hgStrategyRefine = (lv0) => Object.assign({}, lv0, { stop: lv0.stop - 0.25 });
  const out2 = S.mrFwdRows([r]);
  ok(Math.abs(out2[0].stop - (lv.stop - 0.25)) < 1e-9 && out2[0].entry === lv.entry, 'hgStrategyRefine moves the recorded stop exactly as it moves the card\'s (one plan, read twice)');
}

console.log('\n3. driven through the real tab: mount, scan, record, dedup, settle, panel, handoff');
{
  /* hg-setup-core.js is the one home of the directional funding rule the ledger derives fundAgainst from */
  const S = boot(['hg-setup-core.js'].concat(STACK));
  let shift = 0;   /* bars appended after the signal bar on later scans */
  const handed = [];
  S.hgToTradePlanOnclickAttr = (sym, dir, entry, stop, t1) => { handed.push({ sym, dir, entry, stop, t1 }); return 'x'; };
  S.hgContextRead = (rows, dir) => ({ read: '20-read context: 6 against', adverse: true });
  /* the mount's load check names the binance layer; the desk universe path below wins over it */
  S.binancePerpUniverse = async () => []; S.binanceTickers24h = async () => ({});
  /* the desk universe path the tab prefers, carrying the venue funding */
  S.hgDeskLoadDeltaCoinDCX = async () => ({ items: [
    { sym: 'BTCUSDT', exchange: 'delta', turnoverUsd: 3e9, fundingPct: 0.021 },
    { sym: 'ETHUSDT', exchange: 'coindcx', turnoverUsd: 2e9, fundingPct: null },
    { sym: 'SOLUSDT', exchange: 'coindcx', turnoverUsd: 1e9, fundingPct: null }   /* fires too; CoinDCX reports no funding */
  ] });
  /* the series ends TWO closed bars behind the clock on the first scan so a later scan can hand the
     desk one more CLOSED bar (a bar at the clock floor is still forming: mrClosed drops it) */
  const BAR0 = LAST - SEC;
  S.binanceKlines = async (sym) => {
    if (sym === 'ETHUSDT') return mk(Array(250).fill(100), BAR0 + shift * SEC);   /* flat: no signal */
    /* BTC and SOL read the same LONG tape */
    const r = mk(LONG_CLOSES, BAR0);
    if (shift) r.push({ t: LAST, o: 102.5, h: 104.6, l: 102.4, c: 104.3, v: 1000 });   /* trades through T1 (the sma20 mean) */
    return r;
  };
  const tab = S.HG_tabs.find(t => t.id === 'meanrev');
  const el = mkEl();
  tab.mount(el);
  ok(/<div id="mrFwd"><\/div>/.test(el.innerHTML), 'the tab template carries a forward host under the cards');
  ok(/Nothing recorded yet/.test(el._qs['#mrFwd'].innerHTML) && /every 4H mean-reversion plan this desk formed/.test(el._qs['#mrFwd'].innerHTML), 'the panel paints at mount, honestly empty');
  const btn = el._qs['#mrRun'], stat = el._qs['#mrStat'];
  btn._hs.click(); ok(await settle(btn), 'first scan settles');
  ok(/^universe 3 · signals 2 · failed 0/.test(stat.textContent) && /2 forward records written$/.test(stat.textContent), 'the stat line says two records were written (' + stat.textContent + ')');
  let recs = S.hgFwdRecords('MEANREV');
  const btc = recs.find(r => r.sym === 'BTCUSDT'), sol = recs.find(r => r.sym === 'SOLUSDT');
  ok(recs.length === 2 && btc && sol && recs.every(r => r.dir === 'long' && r.tf === '4h'), 'two records: the symbols that fired, none for the flat tape, on the 4h grid');
  ok(recs.every(r => r.barT === BAR0), 'dated on the last CLOSED 4h bar the desk read (' + btc.barT + ' = ' + BAR0 + '), never the clock bar ' + CLOCK);
  ok(recs.every(r => r.mark === 102.5 && r.horizonBars === 10 && r.ticket === true && r.mechanic === 'MEANREV-RSI2'), 'mark, the replay\'s MAX_HOLD horizon, ticket and mechanic ride');
  ok(btc.fundingPct === 0.021 && btc.fundAgainst === false, 'the Delta item\'s funding rides and the ledger derives the directional verdict (a long at +0.021% is not against)');
  ok(sol.fundingPct === undefined && sol.fundAgainst === undefined, 'the CoinDCX item reports no funding: NOT RECORDED, never a zero rate');
  ok(recs.every(r => r.reads && r.reads['context:adverse'] === true && r.reads['record:positive'] === undefined && r.reads['omni:demoted'] === undefined), 'reads: the context ran and said AGAINST; the SETUP RECORD is thin on this tape and the principal layer is absent -- both ABSENT (' + JSON.stringify(btc.reads) + ')');
  const hb = handed.find(h => h.sym === 'BTCUSDT');
  ok(handed.length === 2 && hb && hb.entry === btc.entry && hb.stop === btc.stop && hb.t1 === btc.t1, 'the card\'s SEND TO TRADE PLAN was handed the SAME levels the record carries');
  ok(S.__warns.length === 0, 'nothing thrown into the ledger warn log');
  ok(!/Nothing recorded yet/.test(el._qs['#mrFwd'].innerHTML) && /MEANREV-RSI2/.test(text(el._qs['#mrFwd'].innerHTML)) && /awaiting settlement/.test(text(el._qs['#mrFwd'].innerHTML)), 'the panel repaints after the scan and names the open record');
  btn._hs.click(); ok(await settle(btn), 'second scan settles');
  ok(S.hgFwdRecords('MEANREV').length === 2 && /0 forward records written$/.test(stat.textContent), 'a second scan on the same closed bar writes nothing new (the ledger dedups on the bar) and says so');
  shift = 1;
  btn._hs.click(); ok(await settle(btn), 'third scan settles');
  recs = S.hgFwdRecords('MEANREV');
  const first = recs.filter(r => r.barT === BAR0);
  ok(first.length === 2 && first.every(r => r.state === 't1'), 'the next CLOSED bar, trading through T1, SETTLES both records on the bars the scan itself fetched -- for every symbol, signal or not (the new bar fires nothing: ' + recs.filter(r => r.barT !== BAR0).length + ' new)');
  const st = S.hgFwdStats('MEANREV', null, false);
  ok(st.samples === 2 && st.wins === 2 && st.hit === 1, 'hgFwdStats(MEANREV) reads two settled wins -- the pool CONTRACT REPORT names is live');
  ok(!/awaiting settlement/.test(text(el._qs['#mrFwd'].innerHTML)) && /MEANREV-RSI2/.test(text(el._qs['#mrFwd'].innerHTML)), 'the panel repaints after settlement');
  const sp = S.hgFwdReadSplit('MEANREV');
  ok(sp && sp.settled === 2 && sp.reads['context:adverse'] && sp.reads['context:adverse'].yes.n === 2, 'the hg-v989 read split can now ask whether the context verdict separates on this desk');
  /* the ledger absent: the desk scans exactly as before and claims nothing */
  const S2 = boot(['indicators.js', 'indicators2.js', 'meanrev.js']);
  S2.hgDeskLoadDeltaCoinDCX = S.hgDeskLoadDeltaCoinDCX; S2.binanceKlines = async () => mk(LONG_CLOSES, BAR0);
  S2.binancePerpUniverse = async () => []; S2.binanceTickers24h = async () => ({});
  const el2 = mkEl(); S2.HG_tabs.find(t => t.id === 'meanrev').mount(el2);
  ok(el2._qs['#mrFwd'].innerHTML === '', 'with hg-forward absent the host paints nothing');
  el2._qs['#mrRun']._hs.click(); ok(await settle(el2._qs['#mrRun']), 'scan settles without the ledger');
  ok(/^universe 3 · signals 3 · failed 0/.test(el2._qs['#mrStat'].textContent) && !/forward record/.test(el2._qs['#mrStat'].textContent), 'the stat line claims no records when there is no ledger to write to (' + el2._qs['#mrStat'].textContent + ')');
}

console.log('\n4. CONTRACT REPORT reads the pool it always named');
{
  const S = boot(['indicators.js', 'indicators2.js', 'hg-forward.js', 'meanrev.js', 'contract-report.js']);
  const rows4h = mk(LONG_CLOSES, LAST);
  ok(S.mrSignal(rows4h) && S.mrSignal(rows4h).dir === 'long', 'REACHABILITY: MEAN REVERSION fires on the report tape');
  const line = rep => { const m = rep.sections.find(s => s.id === 'measured'); return m ? m.rows.filter(r => /Forward log · MEANREV/.test(r.name)) : []; };
  let rep = S.hgContractReportRun({ sym: 'BTCUSDT', venue: 'delta', rows4h, rows1h: [], rows15m: [], ticker: { symbol: 'BTCUSDT', mark: 102.5 } });
  let l = line(rep);
  ok(l.length === 1 && l[0].state === 'idle' && /no settled out-of-sample trades/.test(l[0].detail), 'with nothing recorded the MEANREV row reads idle, as it did forever');
  /* a record fired ten bars ago and settled by the tape since */
  const BARX = LAST - 12 * SEC;
  ok(S.hgFwdRecordScan('MEANREV', '4h', [{ sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 98, t1: 103, mark: 100, barT: BARX, mechanic: 'MEANREV-RSI2', ticket: true }], { horizonBars: 10 }) === 1, 'one MEANREV record under the pool');
  S.hgFwdResolve('BTCUSDT', '4h', rows4h);
  ok(S.hgFwdRecords('MEANREV')[0].state === 't1', 'settled on the tape (the plateau at 104 trades through 103)');
  rep = S.hgContractReportRun({ sym: 'BTCUSDT', venue: 'delta', rows4h, rows1h: [], rows15m: [], ticker: { symbol: 'BTCUSDT', mark: 102.5 } });
  l = line(rep);
  ok(l.length === 1 && l[0].state === 'signal' && /1 settled · hit 100\.0%/.test(l[0].detail), 'the report reads `1 settled · hit 100.0%` under MEANREV where the pool used to be empty forever (' + (l[0] && l[0].detail) + ')');
  ok(/\['MEAN REVERSION', 'MEANREV'\]/.test(strip(read('contract-report.js'))), 'the report table names the pool the desk writes');
}

console.log('\n5. wired where it must be, one home, nothing gated');
{
  const src = strip(read('meanrev.js'));
  ok((src.match(/hgFwdRecordScan\(/g) || []).length === 1 && /return W\.hgFwdRecordScan\(MR_FWD_TAB, MR_FWD_TF, recs, \{ horizonBars: MR_FWD_HORIZON \}\)/.test(src), 'one call into the ledger, in mrRecordForward, on the replay\'s own horizon');
  ok(/MR_FWD_HORIZON = MAX_HOLD/.test(src), 'the forward horizon IS the replay timeout, not a second number');
  const run = src.slice(src.indexOf('async function runScan('), src.indexOf('__mr.run = runScan'));
  ok(run.indexOf('mrSettleForward(sym, rows);') > run.indexOf('rows = mrClosed(rows);') && run.indexOf('mrSettleForward(sym, rows);') < run.indexOf('if (!sig) return;'), 'open records settle on the CLOSED bars, for every symbol, before the no-signal return');
  ok(run.indexOf('var recorded = mrRecordForward(results);') > run.indexOf('results.sort(function(a,b){') && run.indexOf('var recorded = mrRecordForward(results);') < run.indexOf('results.map(cardHTML)'), 'every plan in `results` is recorded after the sort and before the paint, shown or not');
  ok(!/hgFwdRecords|hgFwdStats|hgFwdPool|hgFwdReadSplit/.test(run), 'the scan reads nothing back from the ledger: no gate is fed by the record');
  ok((src.match(/hgStrategyRefine\(/g) || []).length === 1 && /var lv = mrTradedPlan\(r\);/.test(src.slice(src.indexOf('function cardHTML('))), 'the traded plan has one home (mrTradedPlan) and cardHTML reads it');
  ok(/mrSettleForward\(sym, rows\)[\s\S]*if \(!sig\) return;/.test(run) && /rows = mrClosed\(rows\);\s*\n\s*var sig = mrSignal\(rows\);/.test(src), 'the closed-bars pin (test-closed-bars-remaining) still holds beside the settle call');
  for (const f of ['hg-gates.js', 'hg-solidity.js', 'cryptogates.js', 'engine.js', 'plans.js']) ok(!/MEANREV-RSI2|'MEANREV'/.test(strip(read(f))), f + ' knows nothing of this desk\'s records');
}

console.log('\n6. version stamps');
{
  const v = (read('build-stamp.js').match(/version:\s*'(hg-v\d+)'/) || [])[1];
  ok(v && parseInt(v.slice(4), 10) >= 997, 'build-stamp at or past hg-v997 (' + v + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches the build stamp');
}

console.log('\n' + passed + ' assertions passed');
