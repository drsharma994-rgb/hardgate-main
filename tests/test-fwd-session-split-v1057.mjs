/* HARDGATE -- hg-v1057: THE SESSION ODDS, AND THE SETUP-ACCURACY MARKS THAT
   FEED IT.

   The accuracy research (hardgate-omnibtc-trendmx-accuracy-research.md,
   recommendation A8) says seasonality claims should be MEASURED, not imported:
   the desk's own settled records, split by the session the setup fired in, is
   the only session table this repo's doctrine permits. So the forward ledger
   now accepts eight new fire-time marks (session tightened to 48 chars,
   trendQuality, leverageState, cvdContext, basisMom, flowAbsorbed, netflowZ,
   liqClusterUsd / liqFuelUsd), folds them so the counts survive pruning, and
   splits the settled records per session with a NEITHER bucket for records
   that carry no mark.

   Nothing is gated on any of it: the split reports, never withholds. Node
   18+, no network. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const text = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

function boot(){
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
  vm.createContext(s);
  vm.runInContext(read('hg-forward.js'), s, { filename: 'hg-forward.js' });
  return s;
}

/* a long plan: entry 100, stop 95, t1 110 -> 2R, barT 1700000000 */
const rec = (sym, extra) => Object.assign({
  tab: 'OBTC', mechanic: 'CROWN', sym, tf: '4h', dir: 'long',
  entry: 100, stop: 95, t1: 110, barT: 1700000000, horizonBars: 20
}, extra || {});
const win  = [{ t: 1700014400, o: 100, h: 111, l: 99, c: 110, v: 1 }];   /* h 111 >= t1 110 */
const lose = [{ t: 1700014400, o: 100, h: 101, l: 94, c: 95, v: 1 }];    /* l 94 <= stop 95 */

console.log('1. the exports exist');
{
  const S = boot();
  ok(typeof S.hgFwdSessionSplit === 'function' && typeof S.hgFwdSessionSplitHtml === 'function',
     'hgFwdSessionSplit and hgFwdSessionSplitHtml are exported');
  ok(typeof S.hgFwdNormalize === 'function' && typeof S.hgFwdFold === 'function',
     'the normaliser and the fold are exported for the direct door');
}

console.log('2. the direct door: valid marks survive, junk is refused, never coerced');
{
  const S = boot();
  S.hgFwdRecord(rec('GOOD1', { session: 'ASIA', trendQuality: 'CHOP', leverageState: 'RESET',
                               cvdContext: 'BOTH-WITH', basisMom: 'ACCEL', flowAbsorbed: true,
                               netflowZ: 0, liqClusterUsd: 0, liqFuelUsd: 1.2e6 }));
  S.hgFwdRecord(rec('JUNK1', { session: '', trendQuality: 'NONE', leverageState: 'yes',
                               cvdContext: 'against', basisMom: '', flowAbsorbed: 'yes',
                               netflowZ: '3', liqClusterUsd: -5, liqFuelUsd: 'x' }));
  S.hgFwdRecord(rec('JUNK2', { session: 123 }));
  S.hgFwdRecord(rec('JUNK3', { session: 'a'.repeat(100) }));
  S.hgFwdRecord(rec('JUNK4', { flowAbsorbed: false, netflowZ: NaN }));
  S.hgFwdRecord(rec('GOOD2', { session: 'S'.repeat(48), netflowZ: 2.5 }));
  const by = {}; S.hgFwdRecords('OBTC').forEach(x => { by[x.sym] = x; });
  ok(by.GOOD1.session === 'ASIA' && by.GOOD1.trendQuality === 'CHOP' && by.GOOD1.leverageState === 'RESET'
     && by.GOOD1.cvdContext === 'BOTH-WITH' && by.GOOD1.basisMom === 'ACCEL' && by.GOOD1.flowAbsorbed === true,
     'every valid mark survives the direct door, unmodified');
  ok(by.GOOD1.netflowZ === 0 && by.GOOD1.liqClusterUsd === 0 && by.GOOD1.liqFuelUsd === 1.2e6,
     'netflowZ and liqClusterUsd of exactly zero are READ zeros; a positive liqFuelUsd survives');
  ok(by.JUNK1.session === undefined && by.JUNK1.trendQuality === undefined && by.JUNK1.leverageState === undefined
     && by.JUNK1.cvdContext === undefined && by.JUNK1.basisMom === undefined && by.JUNK1.flowAbsorbed === undefined
     && by.JUNK1.netflowZ === undefined && by.JUNK1.liqClusterUsd === undefined && by.JUNK1.liqFuelUsd === undefined,
     "junk is refused on all nine: '' is not a session, 'NONE' is not a trend quality, 'yes' is not a state, lowercase 'against' is not a context, '3' is not a number, -5 is not a magnitude");
  ok(by.JUNK2.session === undefined, 'a numeric session is refused, never stringified');
  ok(by.JUNK3.session === undefined, 'an over-long session label (100 chars) is refused');
  ok(by.JUNK4.flowAbsorbed === undefined && by.JUNK4.netflowZ === undefined, 'flowAbsorbed false is the absence of the mark (true is the only recorded value), and NaN is no z-score');
  ok(by.GOOD2.session === 'S'.repeat(48) && by.GOOD2.netflowZ === 2.5, 'a 48-char session is the boundary and survives; a finite non-zero z survives');
  /* the remaining enum values, through the normaliser itself */
  const n1 = S.hgFwdNormalize(rec('N1', { trendQuality: 'TREND', leverageState: 'EXTENDED', cvdContext: 'PERP-ONLY', basisMom: 'ROLL' }));
  const n2 = S.hgFwdNormalize(rec('N2', { leverageState: 'FLAT', cvdContext: 'AGAINST' }));
  ok(n1 && n1.trendQuality === 'TREND' && n1.leverageState === 'EXTENDED' && n1.cvdContext === 'PERP-ONLY' && n1.basisMom === 'ROLL',
     'TREND / EXTENDED / PERP-ONLY / ROLL are the other valid enum values');
  ok(n2 && n2.leverageState === 'FLAT' && n2.cvdContext === 'AGAINST', 'FLAT and AGAINST complete the two enums');
}

console.log('3. the scan path passes the marks through raw — the normaliser decides');
{
  const S = boot();
  S.hgFwdRecordScan('OBTC', '4h', [
    rec('SCAN1', { session: 'LONDON', trendQuality: 'TREND', leverageState: 'FLAT', cvdContext: 'AGAINST' }),
    rec('SCAN2', { session: 42, trendQuality: 'chop', flowAbsorbed: 1 })
  ], { horizonBars: 20 });
  const by = {}; S.hgFwdRecords('OBTC').forEach(x => { by[x.sym] = x; });
  ok(by.SCAN1.session === 'LONDON' && by.SCAN1.trendQuality === 'TREND' && by.SCAN1.leverageState === 'FLAT' && by.SCAN1.cvdContext === 'AGAINST',
     'a desk hand-in on the candidate rides through the scan assembly to the record');
  ok(by.SCAN2.session === undefined && by.SCAN2.trendQuality === undefined && by.SCAN2.flowAbsorbed === undefined,
     'junk on the scan path is refused by the same door (42 is no session, lowercase is no enum, 1 is not the boolean)');
}

console.log('4. settled, split, folded, printed');
{
  const S = boot();
  S.hgFwdRecordScan('OBTC', '4h', [
    rec('A1', { session: 'ASIA', trendQuality: 'CHOP', flowAbsorbed: true, netflowZ: -1.5 }),
    rec('A2', { session: 'ASIA' }),
    rec('L1', { session: 'LONDON', trendQuality: 'TREND', netflowZ: 0.5 }),
    rec('N1')                                    /* no session mark */
  ], { horizonBars: 20 });
  S.hgFwdResolve('A1', '4h', win);   /* ASIA win +2R  */
  S.hgFwdResolve('A2', '4h', lose);  /* ASIA loss -1R */
  S.hgFwdResolve('L1', '4h', win);   /* LONDON win +2R */
  S.hgFwdResolve('N1', '4h', win);   /* NEITHER win   */
  const sp = S.hgFwdSessionSplit('OBTC');
  ok(sp && sp.settled === 4 && sp.marked === 3 && sp.unmarked === 1,
     'four settled: three marked, one NEITHER (' + JSON.stringify([sp.settled, sp.marked, sp.unmarked]) + ')');
  ok(sp.cells.ASIA.n === 2 && sp.cells.ASIA.wins === 1 && sp.cells.LONDON.n === 1 && sp.cells.LONDON.wins === 1 && !sp.cells['NY PM'],
     'cells: ASIA 2 (one win), LONDON 1 (one win), no cell for a session nothing recorded');
  ok(Math.abs(sp.cells.ASIA.r - 0.5) < 1e-9 && sp.cells.ASIA.hit === 0.5 && sp.cells.LONDON.r === 2 && sp.cells.LONDON.hit === 1,
     'R and hit per cell: a +2R win and a -1R loss average +0.50R at 50%; the one LONDON win reads +2.00R at 100%');
  const h = text(S.hgFwdSessionSplitHtml('OBTC'));
  ok(/SESSION ODDS/.test(h) && /3 of 4 settled records carried a session mark/.test(h), 'the panel line leads with the marked count');
  ok(/ASIA — n 2 · hit 50% · \+0\.50R/.test(h) && /LONDON — n 1 · hit 100% · \+2\.00R/.test(h), 'and prints one line per session with n, hit and mean R');
  ok(/NEITHER — n 1 \(records without a session mark\)/.test(h) && /Reported, not gated/.test(h), 'the NEITHER bucket is named, and the reported-not-gated line');
  const f = S.hgFwdFold({}, S.hgFwdRecords('OBTC'))['OBTC|CROWN'];
  ok(f && f.sess && f.sess.ASIA.wins === 1 && f.sess.ASIA.losses === 1 && f.sess.LONDON.wins === 1 && !f.sess.LONDON.losses,
     'the fold carries a bucket per session: ASIA 1W/1L, LONDON 1W/0L');
  ok(f.tq.CHOP.wins === 1 && f.tq.TREND.wins === 1 && f.fab.wins === 1 && f.nz && f.nz.sum === -1 && f.nz.n === 2,
     'and the other marks fold too: tq per value, the one flowAbsorbed boolean, netflowZ as sum+count (-1.5 + 0.5 over 2 rows)');
  /* the folded tail is read back once the live records are gone */
  S.__store['hg_forward_agg_v1'] = JSON.stringify(S.hgFwdFold({}, S.hgFwdRecords('OBTC')));
  delete S.__store['hg_forward_v1'];
  const spT = S.hgFwdSessionSplit('OBTC');
  ok(spT && spT.marked === 0 && spT.agg && spT.agg.ASIA.wins === 1 && spT.agg.ASIA.losses === 1 && spT.agg.LONDON.wins === 1,
     'with no live record left, the split reads the folded buckets (ASIA 1W/1L, LONDON 1W)');
  ok(/folded beyond the live cap: (ASIA|LONDON) 1W\/1L/.test(text(S.hgFwdSessionSplitHtml('OBTC'))),
     'and the folded tail prints on the panel line');
}

console.log('5. an honest empty: no mark, no line');
{
  const S = boot();
  ok(S.hgFwdSessionSplit('OBTC') === null && S.hgFwdSessionSplitHtml('OBTC') === '',
     'a desk with no records: the split is null and the HTML prints nothing');
  S.hgFwdRecordScan('OBTC', '4h', [rec('U1'), rec('U2')], { horizonBars: 20 });
  S.hgFwdResolve('U1', '4h', win);
  S.hgFwdResolve('U2', '4h', lose);
  ok(S.hgFwdSessionSplit('OBTC') === null && S.hgFwdSessionSplitHtml('OBTC') === '',
     'settled records that carry no session mark: nothing prints — an absent measurement is not a clean bill');
}

console.log('6. the pure array path (hand-dated outcomes, no storage)');
{
  const S = boot();
  const arr = [
    { state: 't1',   rr: 2,   session: 'ASIA' },
    { state: 'stop', rr: 2,   session: 'ASIA' },
    { state: 't1',   rr: 1.5, session: 'NY PM' },
    { state: 't1',   rr: 2 }                                   /* unmarked */
  ];
  const sp = S.hgFwdSessionSplit(arr);
  ok(sp && sp.settled === 4 && sp.marked === 3 && sp.unmarked === 1 && sp.cells['NY PM'].n === 1 && sp.cells['NY PM'].r === 1.5,
     'the array path reads hand-dated records directly: 3 marked, 1 NEITHER, NY PM 1/1 at +1.50R');
  ok(/NY PM — n 1 · hit 100% · \+1\.50R/.test(text(S.hgFwdSessionSplitHtml(arr))), 'and the HTML renders off the same array');
}

console.log('\n' + passed + ' passed, 0 failed');
