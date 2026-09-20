/* HARDGATE — seven packs built the record-and-settle chain, and nothing drove
   it end to end.

   Packs 872 through 878 built CRYPTO SCAN's forward evidence one link at a
   time: a versioned tier key (872), the bar the engine actually read (873),
   the fill model (874), the scan resolving its own records (875), the panel
   that shows them (876), the closed bars both layers vote on (877), and the
   overlap correction (878). Each has its own test. NONE of them drives a scan,
   waits for bars that did not exist, scans again, and asserts the record
   settled -- so every link was pinned and the chain was not. If any joint
   broke, the tab would quietly accumulate unsettled records again, which is
   the exact failure 875 existed to fix.

   This drives the real runScan twice over a tape that advances between them,
   and pins the four cases that decide whether a record can settle at all:

     bars advance, setup still fires      resolved
     contract no longer produces a setup  resolved  (the resolve runs BEFORE
                                                     the engine)
     bars fall below the 230 minimum      resolved  (and BEFORE the skip)
     contract leaves the universe         NOT resolved -- the honest limit

   The placement of the resolve call is the whole point of the middle two, and
   it was a comment until now.

   IT ALSO FIXES A UNIT MISMATCH. hgFwdResolve is keyed by SYMBOL but returns
   the number of RECORDS it settled, and one symbol holds one record per bar it
   fired on. Pack 875 divided the record count by the symbol count, so a
   contract that fired on three consecutive bars and settled all three printed

     3/1 open records settled

   a ratio able to exceed its own denominator. hgFwdOpenTally now returns both
   counts from one pass, and the remainder -- open records whose contract the
   scan did not reach -- is named rather than left as a silent gap.

   Run: node tests/test-cryptoscan-settle-chain.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
function ok(cond, msg){
  if (cond){ passed++; console.log('  ok   ' + msg); }
  else { console.error('  FAIL ' + msg); process.exitCode = 1; }
}
function stripComments(src){
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');
}
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {};
  s.setTimeout = (f) => { try{ f && f(); }catch(e){} return 0; }; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, appendChild(){}, setAttribute(){} }),
                 head: { appendChild(){} }, addEventListener(){} };
  s.localStorage = (() => { const m = {}; return {
    getItem: k => (k in m ? m[k] : null), setItem(k, v){ m[k] = String(v); },
    removeItem(k){ delete m[k]; } }; })();
  s.location = { href: 'https://x/', search: '', protocol: 'https:' };
  s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  for (const f of ['indicators.js', 'indicators2.js', 'order-flow.js',
                   'liquidation-intelligence.js', 'cryptoscan-voting-v3.js', 'sentiment.js',
                   'cryptoultra.js', 'hg-forward.js', 'cryptoscan.js'])
    vm.runInContext(fs.readFileSync(root + f, 'utf8'), s, { filename: f });
  return s;
}
const SCAN = fs.readFileSync(root + 'cryptoscan.js', 'utf8');
const FWD = fs.readFileSync(root + 'hg-forward.js', 'utf8');
const SEC = 900;
const NOW_BAR = Math.floor(Date.now() / 1000 / SEC) * SEC;

function fakeEl(){
  const nodes = {};
  return {
    _html: '',
    set innerHTML(v){ this._html = String(v); },
    get innerHTML(){ return this._html; },
    querySelector(sel){
      const id = String(sel).replace(/^#/, '');
      if (this._html.indexOf('id="' + id + '"') < 0) return null;
      if (!nodes[id]) nodes[id] = { id: id, innerHTML: '', style: {}, textContent: '',
                                    disabled: false, addEventListener(){},
                                    classList: { toggle(){}, contains(){ return false; } } };
      return nodes[id];
    },
    _node(id){ return nodes[id] || null; }
  };
}
function tape(n, endBar, drift, seed0){
  let seed = seed0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const rows = []; let px = 100;
  for (let i = 0; i < n; i++){
    const o = px, c = px * (1 + (rnd() - 0.5 + drift) * 0.010);
    rows.push({ t: endBar - (n - 1 - i) * SEC, o: o, c: c, h: Math.max(o, c) * 1.004,
                l: Math.min(o, c) * 0.997, v: 1000 + rnd() * 1000 });
    px = c;
  }
  return rows;
}
const H = Math.floor(Date.now() / 1000 / 3600) * 3600, r1h = [];
for (let i = 199; i >= 0; i--) r1h.push({ t: H - i * 3600, o: 100, c: 101, h: 102, l: 99, v: 5000 });

/** scan once, let the world change, scan again */
async function twoScans(mutate){
  const S = boot();
  let bars = tape(300, NOW_BAR - 30 * SEC, 0.08, 3);
  let universe = [{ sym: 'AAA', exchange: 'delta', base: 'AAA' }];
  S.hgDeskLoadDeltaCoinDCX = async () => ({ items: universe, rawLen: universe.length,
    venueCounts: { delta: universe.length, coindcx: 0 } });
  S.hgDeskFetchKlines = async (it, tf) => (tf === '15m' ? bars.slice() : r1h.slice());
  S.hgDeskFetchKlinesResult = async (it, tf) => ({ rows: tf === '15m' ? bars.slice() : r1h.slice(),
                                                    ok: true, reason: null, error: null });
  S.hgSentimentLoad = async () => ({});
  const tab = (S.HG_tabs || []).filter(t => t && t.id === 'cryptoscan')[0];
  const el = fakeEl();
  tab.mount(el);
  await tab.refresh();
  const rowsOf = () => { const j = JSON.parse(S.localStorage.getItem('hg_forward_v1') || '{}');
                         return j.rows || j || []; };
  const after1 = { rows: rowsOf(), run: S.cryptoScanState() };
  if (mutate) mutate({ set bars(v){ bars = v; }, get bars(){ return bars; },
                       set universe(v){ universe = v; }, get universe(){ return universe; } });
  await tab.refresh();
  return { S: S, el: el, after1: after1, rows: rowsOf(), run: S.cryptoScanState() };
}

/* ---------------------------------------------------------------- 1
   THE CHAIN. Record on one scan, settle on the next. */
{
  const v = await twoScans(c => { c.bars = tape(330, NOW_BAR, 0.08, 3); });
  ok(v.after1.rows.length === 1, 'the first scan wrote one forward record');
  const rec1 = v.after1.rows[0];
  ok(rec1.state === 'open', 'open, as it must be — its future had not printed');
  ok(rec1.tab === 'CRYPTO SCAN' && rec1.tf === '15m', 'keyed to this desk at 15m');
  ok(/@V\d+$/.test(rec1.mechanic), 'with the versioned tier key from pack 872 ('
     + rec1.mechanic + ')');
  ok(rec1.barT === v.after1.run.setups[0].bar.t,
     'on the CLOSED bar the engine voted (pack 873)');
  ok(rec1.mark === v.after1.run.setups[0].price, 'carrying the mark the fill model needs (874)');

  ok(v.run.resolved === 1, 'the second scan settled it (pack 875)');
  const settled = v.rows.filter(r => r.state && r.state !== 'open');
  ok(settled.length === 1 && settled[0].sym === 'AAA',
     'and the record now carries an outcome: ' + settled[0].state);
  ok(settled[0].barT === rec1.barT, 'the same record, not a new one');

  /* the outcome came from bars that did not exist when it was written */
  ok(v.after1.rows[0].barT < NOW_BAR - 29 * SEC,
     'it fired on a bar at least 30 bars before the second scan\'s last');

  /* and it reaches the pool the panel reads */
  const pool = v.S.hgFwdPool('CRYPTO SCAN');
  const total = Object.keys(pool).reduce((a, k) => a + pool[k].samples, 0);
  ok(total === 1, 'the pool the forward panel reads has one settled sample');
  ok(/T1-FIRST/.test(text(v.S.csFwdPanelHTML())), 'and the panel renders a table for it');
}

/* ---------------------------------------------------------------- 2
   WHERE THE RESOLVE SITS. Two cases that only pass if it runs before the
   engine and before the 230-bar skip. */
{
  /* the contract stops producing a setup */
  const flat = await twoScans(c => {
    const keep = c.bars.slice();
    let px = keep[keep.length - 1].c;
    const ext = [];
    for (let i = 1; i <= 30; i++){
      ext.push({ t: NOW_BAR - (30 - i) * SEC, o: px, c: px * 1.0004,
                 h: px * 1.006, l: px * 0.999, v: 1000 });
      px = px * 1.0004;
    }
    c.bars = keep.concat(ext);
  });
  ok(flat.run.resolved === 1,
     'a contract whose reads changed still settles — the resolve runs before the engine');

  /* the contract's bars fall below the minimum */
  const thin = await twoScans(c => { c.bars = tape(330, NOW_BAR, 0.08, 3).slice(-60); });
  ok(thin.run.skipped === 1, 'a 60-bar contract is skipped for the scan');
  ok(thin.run.setups.length === 0, 'and produces no setup');
  ok(thin.run.resolved === 1,
     'but its open record still settles — the resolve runs before the skip');

  /* source: both facts are about ORDER, so pin the order */
  const bare = stripComments(SCAN);
  const iResolve = bare.indexOf('hgFwdResolve(item.sym');
  const iSkip = bare.indexOf('rows15m.length < 230');
  const iEngine = bare.indexOf('var res = engine({');
  ok(iResolve > 0 && iSkip > 0 && iEngine > 0, 'all three points are in the loop');
  ok(iResolve < iSkip, 'the resolve is written before the skip');
  ok(iResolve < iEngine, 'and before the engine call');
}

/* ---------------------------------------------------------------- 3
   THE HONEST LIMIT. A contract the scan no longer reaches cannot settle. */
{
  const gone = await twoScans(c => {
    c.bars = tape(330, NOW_BAR, 0.08, 3);
    c.universe = [{ sym: 'ZZZ', exchange: 'delta', base: 'ZZZ' }];
  });
  ok(gone.run.resolved === 0, 'nothing was resolved');
  ok(gone.rows.filter(r => r.sym === 'AAA' && r.state === 'open').length === 1,
     'AAA\'s record is still open — the scan had no bars for it');
  ok(gone.run.owed >= 1, 'and the run reports it as owed');

  /* the status line says so rather than leaving a silent gap */
  const status = text((gone.el._node('csStat') || {}).textContent || '');
  ok(/whose contract the scan did not reach/.test(status),
     'the status line names the remainder: "' + status.slice(0, 110) + '"');

  /* a run that settles everything says nothing extra */
  const clean = await twoScans(c => { c.bars = tape(330, NOW_BAR, 0.08, 3); });
  const cs = text((clean.el._node('csStat') || {}).textContent || '');
  ok(/1\/1 open records settled/.test(cs), 'a clean run reads 1/1: "' + cs.slice(0, 110) + '"');
  ok(!/did not reach/.test(cs), 'with no remainder clause');
}

/* ---------------------------------------------------------------- 4
   RECORDS AND SYMBOLS ARE DIFFERENT UNITS.

   The fixture is deliberately mixed -- two tabs, two timeframes, settled rows
   beside open ones, one symbol holding several -- because a single-tab,
   single-timeframe, all-open log cannot tell a correct tally from one that
   ignores its filters. Mutations of each filter survived exactly that fixture. */
{
  const S = boot();
  const T = S.hgFwdOpenTallyOf;
  ok(typeof T === 'function', 'hgFwdOpenTally is exported');

  const rec = (tab, tf, sym, bars, hb) => S.hgFwdRecordScan(tab, tf,
    [{ sym: sym, dir: 'long', mechanic: 'M@V5', entry: 100, stop: 95, t1: 107.5,
       mark: 100, barT: bars }], { horizonBars: hb || 24 });

  /* CRYPTO SCAN, 15m: one symbol on three bars, plus a second symbol */
  for (let b = 5; b >= 3; b--) rec('CRYPTO SCAN', '15m', 'AAA', NOW_BAR - b * SEC);
  rec('CRYPTO SCAN', '15m', 'BBB', NOW_BAR - 4 * SEC);
  /* another timeframe on the same desk, and another desk entirely */
  rec('CRYPTO SCAN', '4h', 'CCC', Math.floor(NOW_BAR / 14400) * 14400 - 14400, 20);
  rec('OMNIGOLD', '15m', 'DDD', NOW_BAR - 4 * SEC);

  const list = () => { const j2 = JSON.parse(S.localStorage.getItem('hg_forward_v1') || '{}');
                       return j2.rows || j2; };
  ok(list().length === 6, 'six records across two desks and two timeframes');

  let t = T(list(), 'CRYPTO SCAN', '15m');
  ok(t.records === 4, 'four open 15m records on this desk (' + t.records + ')');
  ok(t.syms.length === 2, 'on two symbols (' + t.syms.join(',') + ')');
  ok(t.records !== t.syms.length, 'which are not the same number');
  ok(t.syms.indexOf('CCC') < 0, 'the 4h record is excluded by the timeframe filter');
  ok(t.syms.indexOf('DDD') < 0, 'and the other desk by the tab filter');

  /* settling three of them must drop the record count, not the symbol count */
  const bars = [];
  for (let i = 5; i >= 0; i--) bars.push({ t: NOW_BAR - i * SEC, o: 100, c: 108, h: 108, l: 99.5, v: 1000 });
  ok(S.hgFwdResolve('AAA', '15m', bars) === 3,
     'hgFwdResolve settles and returns THREE — records, not symbols');
  t = T(list(), 'CRYPTO SCAN', '15m');
  ok(t.records === 1, 'one open record left (' + t.records + ')');
  ok(t.syms.length === 1 && t.syms[0] === 'BBB', 'on the one symbol still waiting');
  ok(list().filter(r => r.state && r.state !== 'open').length === 3,
     'and the three settled rows are still in the log, no longer counted as open');

  /* the window wrapper must report the same two numbers the pure one does */
  const w = S.hgFwdOpenTally('CRYPTO SCAN', '15m');
  ok(w && w.records === t.records && w.syms.length === t.syms.length,
     'the window wrapper agrees with the pure tally (' + (w && w.records) + ' records)');
  const wAll = S.hgFwdOpenTally('CRYPTO SCAN', null);
  ok(wAll.records === 2 && wAll.syms.length === 2,
     'and with no timeframe it counts both of this desk\'s open rows');

  /* the old wrapper still answers for every existing caller */
  ok(S.hgFwdOpenSymsOf(list(), 'CRYPTO SCAN', '15m').join(',') === 'BBB',
     'hgFwdOpenSyms is unchanged for its existing callers');
  ok(T([], 'X', '15m').records === 0 && T(null, 'X', '15m').syms.length === 0,
     'an empty or missing log tallies zero');
}

/* ---------------------------------------------------------------- 5
   __results reports RECORDS owed, not symbols. */
{
  const S = boot();
  /* three open records for one symbol the scan will not reach */
  for (let b = 5; b >= 3; b--)
    S.hgFwdRecordScan('CRYPTO SCAN', '15m',
      [{ sym: 'GONE', dir: 'long', mechanic: 'M@V5', entry: 100, stop: 95, t1: 107.5,
         mark: 100, barT: NOW_BAR - b * SEC }], { horizonBars: 24 });

  let bars = tape(300, NOW_BAR, 0.08, 3);
  S.hgDeskLoadDeltaCoinDCX = async () => ({ items: [{ sym: 'AAA', exchange: 'delta', base: 'AAA' }],
    rawLen: 1, venueCounts: { delta: 1, coindcx: 0 } });
  S.hgDeskFetchKlines = async (it, tf) => (tf === '15m' ? bars.slice() : r1h.slice());
  S.hgDeskFetchKlinesResult = async (it, tf) => ({ rows: tf === '15m' ? bars.slice() : r1h.slice(),
                                                    ok: true, reason: null, error: null });
  S.hgSentimentLoad = async () => ({});
  const tab = (S.HG_tabs || []).filter(x => x && x.id === 'cryptoscan')[0];
  const el = fakeEl();
  tab.mount(el);
  await tab.refresh();
  const run = S.cryptoScanState();

  ok(run.owedSyms === 1, 'one symbol was owed');
  ok(run.owed === 3, 'but THREE records — and __results reports the records (' + run.owed + ')');
  ok(run.owed !== run.owedSyms, 'the two are reported separately because they differ');
  ok(run.resolved === 0, 'none settled, because the scan never fetched GONE');

  const status = text((el._node('csStat') || {}).textContent || '');
  ok(/0\/3 open records settled/.test(status),
     'and the status line reads records over records: "' + status.slice(40, 130) + '"');
  ok(/\(3 whose contract the scan did not reach\)/.test(status), 'naming all three');
}

/* ---------------------------------------------------------------- 6
   Source. */
{
  const bare = stripComments(SCAN);
  ok(/owedRows = \+openTally\.records \|\| 0;/.test(bare),
     'the tab takes the record count for its denominator');
  ok(/resolved \+ '\/' \+ owedRows \+ ' open records settled'/.test(bare),
     'and prints records over records');
  ok(!/resolved \+ '\/' \+ owedN/.test(bare), 'the mixed-unit ratio is gone');
  ok(/owedSyms && owed\[item\.sym\]/.test(bare),
     'while the per-contract check still uses the symbol set');
  ok(/owed: owedRows, owedSyms: owedSyms/.test(bare),
     'and __results carries both, labelled');
  ok(/hgFwdOpenTally\(list, tab, tf\)\.syms/.test(stripComments(FWD)),
     'hgFwdOpenSyms is now one pass over the same tally');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
