/* hg-v989 — THE REPLAY NAMED THE READS AND NOTHING RECORDED THEM GOING
   FORWARD; NOW EVERY OMNIROUTE AND OMNIPRESENT RECORD MARKS THE READS ITS OWN
   REPLAY FLAGGED, AND THE LEDGER COUNTS THEM ON SETTLED RECORDS.

   hg-v987 named two OMNIROUTE leans "worth a forward measurement"; hg-v988
   found one out-of-sample verdict on OMNIPRESENT and said the forward ledger
   was where a confirmation would come from. Neither desk's forward record
   carried any of those reads (hg-v955's shape, one pack later). This pack:
     - hg-forward.js: `reads` -- an object of named booleans on the record,
       three states per read (true / false / absent = NOT RECORDED), booleans
       only, keys bounded; folded per read beyond the live cap; hgFwdReadSplit
       counts the marked cohort against its complement on settled records,
       hgFwdReadSplitHtml renders it on the shared panel and nothing when no
       record carries a mark
     - the two generators write `tab` (and OMNIROUTE `pillarHalf`, the
       replay's own half-max bar per pillar) into the literals
     - omnipresent.js `opReadMarks` and omniroute.js `hgOmniReadMarks` mark
       every read in verdicts ∪ leans they have a reader for, READ off the
       literal, with the generator's own predicates; a read with no reader is
       absent, never guessed
     - the one renderer (hgOmniFactorSepHtml) prints the forward count beside
       each replay row, on both desks
   Nothing is gated on any of it.

   Run: node tests/test-forward-read-marks.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { swCacheOk } from './helpers/build-version.mjs';
import { run as opRun, literal as opLiteral, splice as opSplice, factors as opFactors, loadRows as opLoadRows } from '../scripts/omnipresent-factor-separation.mjs';
import { run as omniRun, literal as omniLiteral, splice as omniSplice, loadRows as omniLoadRows, pillarInventory } from '../scripts/omniroute-factor-separation.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const stripComments = src => String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1 ');

function boot(files, extra){
  const store = {};
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} }, Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date, Intl,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, TypeError, Set, Map, encodeURIComponent, setTimeout, clearTimeout };
  s.window = s; s.globalThis = s; s.self = s; s.HG_tabs = []; s.HG_warmups = []; s.HG_TAB_MODS = {}; s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] }),
                 head: { appendChild(){} }, body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  s.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  s.__store = store;
  s.location = { href: 'https://x/', search: '', protocol: 'https:' }; s.navigator = { userAgent: 'node' }; s.fetch = async () => ({ ok: true, json: async () => ({}) });
  if (extra) Object.assign(s, extra);
  vm.createContext(s);
  for (const f of files) vm.runInContext(read(f), s, { filename: f });
  return s;
}
const mk = () => ({ innerHTML: '', textContent: '', className: '', disabled: false, style: {}, firstElementChild: { style: {} }, _handlers: {},
  classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } }, querySelector(){ return mk(); }, querySelectorAll(){ return []; },
  addEventListener(ev, fn){ this._handler = fn; this._handlers[ev] = fn; } });
const now = Math.floor(Date.now() / 1000);
function tape(n, seed, drift, sec){ const out = []; let p = 80 + (seed % 40), s = seed * 7919 + 3; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const t0 = Math.floor(now / sec) * sec - n * sec; for (let i = 0; i < n; i++){ p = p * (1 + ((rnd() - 0.5) * 0.008 + drift)); const r = p * 0.004 * (0.5 + rnd()); out.push({ t: t0 + i * sec, o: p - r * 0.3, h: p + r, l: p - r, c: p, v: 900 + rnd() * 300 }); } return out; }
const OMNI = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'plans.js', 'hg-mechanics.js', 'hg-forward.js', 'hg-gates.js', 'hg-plan.js', 'hg-solidity.js', 'omniroute.js'];

console.log('1. the ledger: booleans only, three states per read, bounded keys');
{
  const S = boot(['hg-forward.js']);
  const sec = 3600, bar = Math.floor(now / sec) * sec - 2 * sec;
  const row = (sym, reads) => ({ sym, dir: 'long', entry: 100, stop: 99, t1: 102, mark: 100, barT: bar, reads });
  const junk = { 'ev:stretched': true, 'gate:x': false, one: 1, zero: 0, no: 'no', empty: '', obj: {}, nul: null, 'bad key!!': true, ['k'.repeat(60)]: true };
  const added = S.hgFwdRecordScan('T', '1h', [row('AUSD', junk), row('BUSD', { 'ev:stretched': false }), row('CUSD'), row('DUSD', { nothing: 'kept' }), row('EUSD', [true])], { horizonBars: 20 });
  ok(added === 5, 'five records written (' + added + ')');
  const recs = S.hgFwdRecords('T'); const by = {}; recs.forEach(r => { by[r.sym] = r; });
  ok(JSON.stringify(by.AUSD.reads) === JSON.stringify({ 'ev:stretched': true, 'gate:x': false }), 'ONLY the two booleans survive: 1, 0, "no", "", {}, null are dropped, never coerced; an illegal key and an over-long key are dropped (' + JSON.stringify(by.AUSD.reads) + ')');
  ok(by.BUSD.reads['ev:stretched'] === false, 'false is a real mark (the read was asked and not carried)');
  ok(by.CUSD.reads === undefined && by.DUSD.reads === undefined && by.EUSD.reads === undefined, 'no reads, junk-only reads and an array all record NOTHING -- absent, not an empty object');
  const many = {}; for (let i = 0; i < 25; i++) many['r' + String(i).padStart(2, '0')] = true;
  S.hgFwdRecordScan('T', '1h', [row('FUSD', many)], { horizonBars: 20 });
  const f = S.hgFwdRecords('T').filter(r => r.sym === 'FUSD')[0];
  ok(Object.keys(f.reads).length === 16, 'a caller handing in 25 reads keeps 16 -- the store is not a dumping ground (' + Object.keys(f.reads).length + ')');
  /* settle through the real resolver: A and B win, C loses; D and E carry no reads */
  const win = [{ t: bar + sec, o: 100, h: 103, l: 99.5, c: 102.5 }], lose = [{ t: bar + sec, o: 100, h: 100.5, l: 98.5, c: 98.7 }];
  S.hgFwdResolve('AUSD', '1h', win); S.hgFwdResolve('BUSD', '1h', lose); S.hgFwdResolve('CUSD', '1h', win); S.hgFwdResolve('DUSD', '1h', win);
  const st = {}; S.hgFwdRecords('T').forEach(r => { st[r.sym] = r.state; });
  ok(st.AUSD === 't1' && st.BUSD === 'stop' && st.CUSD === 't1' && st.DUSD === 't1' && st.EUSD !== 't1' && st.EUSD !== 'stop', 'four settled (A win, B stop, C win, D win), E and F open');
  const sp = S.hgFwdReadSplit('T');
  ok(sp && sp.settled === 4 && sp.marked === 2, 'split counts 4 settled, 2 carrying a read mark (' + sp.settled + '/' + sp.marked + ')');
  const e = sp.reads['ev:stretched'];
  ok(e.yes.n === 1 && e.yes.wins === 1 && e.yes.r === 2 && e.no.n === 1 && e.no.wins === 0 && e.no.r === -1 && e.unmarked === 2, 'ev:stretched: carried n=1 +2R, not carried n=1 -1R, TWO settled records carry no mark for it and count as NEITHER');
  ok(sp.reads['gate:x'].no.n === 1 && sp.reads['gate:x'].yes.n === 0 && sp.reads['gate:x'].unmarked === 3, 'gate:x: one false, no true, three unmarked -- the buckets partition the settled set per read');
  ok(!sp.reads.one && !sp.reads.nothing, 'dropped junk never becomes a read');
  const h = text(S.hgFwdReadSplitHtml('T'));
  ok(/REPLAY READ SPLIT/.test(h) && /2 of 4 settled records carry a read mark/.test(h) && /ev:stretched · carried \+2\.000R at 100% on n=1 · not carried -1\.000R at 0% on n=1 · 2 settled carry no mark/.test(h), 'the panel line names the read, both cohorts and the unmarked count');
  ok(/Reported, not gated/.test(h), 'and says it gates nothing');
  ok(S.hgFwdReadSplitHtml('NOPE') === '' && S.hgFwdReadSplit('NOPE').marked === 0, 'a desk with no marks renders NOTHING -- an empty split is not a clean bill');
  /* the fold, so the split outlives the live cap */
  const fold = S.hgFwdFold({}, S.hgFwdRecords('T'))['T|1h'];
  ok(fold.rd && fold.rd['ev:stretched'].t.wins === 1 && fold.rd['ev:stretched'].f.losses === 1 && fold.rd['gate:x'].f.wins === 1 && fold.rd['gate:x'].t.wins + fold.rd['gate:x'].t.losses === 0, 'hgFwdFold folds each read into its own true/false pair (unmarked into neither)');
  ok(fold.wins === 3 && fold.losses === 1, 'the fold\'s own totals are untouched (3W/1L)');
  /* an aggregate row reaches the split as the folded tail */
  S.localStorage.setItem('hg_forward_agg_v1', JSON.stringify({ 'T|1h': { tab: 'T', wins: 9, losses: 4, expired: 0, rrSum: 18, rd: { 'ev:stretched': { t: { wins: 5, losses: 1, expired: 0 }, f: { wins: 4, losses: 3, expired: 0 } } } } }));
  const sp2 = S.hgFwdReadSplit('T');
  ok(sp2.reads['ev:stretched'].agg && sp2.reads['ev:stretched'].agg.yes.wins === 5 && sp2.reads['ev:stretched'].agg.no.losses === 3, 'the folded pairs beyond the live cap are read back per read');
  ok(/folded beyond the live cap: carried 5W\/1L, not carried 4W\/3L/.test(text(S.hgFwdReadSplitHtml('T'))), 'and printed');
  ok(/hgFwdReadSplitHtml\(tab\)/.test(stripComments(read('hg-forward.js')).split('W.hgFwdPanelHTML = function')[1].split('return h;')[0]), 'the shared forward panel appends the read split (textual: the panel body is one function)');
}

console.log('\n2. OMNIPRESENT marks the reads its literal names, with the generator\'s own predicates');
{
  const S = boot(OMNI.concat(['omnigold.js', 'omnipresent.js']));
  const T = S.HG_OP_FACTOR_SEP;
  ok(T && T.tab === 'OMNIPRESENT', 'the literal names its desk (tab)');
  const keys = [].concat(T.verdicts, T.leans);
  ok(T.verdicts.indexOf('ev:stretched') >= 0, 'the hg-v988 verdict is among the reads (' + T.verdicts.join(',') + ')');
  const rows = opLoadRows();
  const { factors: F } = opFactors(rows);
  const pickOf = {}; F.forEach(f => { pickOf[f.key] = f.pick; });
  let compared = 0, agree = 0, marked = {};
  for (let i = 0; i < rows.length; i += 17){
    const r = rows[i];
    const m = S.opReadMarks({ zone: { srcs: r.srcs, confluence: r.confluence, distAtr: r.distAtr }, evidence: r.evidence }) || {};
    for (const k of keys){
      if (!(k in m)) continue;
      marked[k] = (marked[k] || 0) + 1; compared++;
      if (m[k] === !!pickOf[k](r)) agree++;
    }
  }
  ok(compared > 2000 && agree === compared, 'on ' + compared + ' (row, read) pairs sampled from the replay, the desk mark equals the generator\'s pick every time');
  ok(T.verdicts.every(k => marked[k] === Math.ceil(rows.length / 17)), 'EVERY verdict read is marked on every sampled row -- a verdict cannot be silently unmeasured');
  const unread = keys.filter(k => !marked[k]);
  ok(unread.length && unread.every(k => /^geom:/.test(k)), 'the reads with no reader are left ABSENT and are the geometry bands, derivable from the record\'s own levels (' + unread.join(', ') + ')');
  ok(S.opReadMarks({ zone: { srcs: ['round number'], confluence: 3, distAtr: 0.1 }, evidence: ['stretched +1.7xATR above EMA21 — rubber band', 'volume climax — 2.9σ'] })['ev:stretched'] === true
     && S.opReadMarks({ zone: { srcs: [], confluence: 1, distAtr: 2 }, evidence: ['volume climax — 2.9σ'] })['ev:stretched'] === false, 'the stretched family is a PREFIX of the live evidence string, as hasEv reads it');
  ok(S.opReadMarks({ zone: { srcs: ['round number'], confluence: 3 } }) && S.opReadMarks({ zone: { srcs: ['round number'], confluence: 3 } })['ev:stretched'] === undefined, 'no evidence array: the evidence reads are ABSENT, not false');
  ok(S.opReadMarks(null) === undefined && S.opReadMarks({}) === undefined, 'nothing to read, nothing marked');
  ok(S.opReadMarks({ zone: { srcs: [], confluence: 1, distAtr: 2 }, evidence: ['volume climax — tape stretched thin'] })['ev:stretched'] === false, 'a family named INSIDE another evidence string is not that read: prefix, not substring');
  ok(S.opReadMarks({ zone: { srcs: [], confluence: 1, distAtr: 0.25 }, evidence: [] })['zone:distLt025'] === false && S.opReadMarks({ zone: { srcs: [], confluence: 1, distAtr: 0.2499 }, evidence: [] })['zone:distLt025'] === true, 'the distance band is strict at 0.25, as the generator picks it');
  /* the real scan: the census fixture, a swept zone so the head is TRIGGERED */
  const UNI = []; for (let i = 0; i < 6; i++) UNI.push({ sym: 'OP' + i + 'USD', base: 'OP' + i, exchange: 'delta' });
  function topTape(n, back){ back = back || 0; const out = []; let s = 5; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; const t0 = Math.floor(now / 3600) * 3600 - (n + back) * 3600;
    for (let i = 0; i < n; i++){ let p; const tail = n - i; if (tail > 70) p = 95 + Math.sin(i / 9) * 3 + (rnd() - 0.5) * 0.6; else if (tail > 50) p = 96 + (70 - tail) * 0.72; else if (tail > 40) p = 110.4 - (50 - tail) * 0.42; else if (tail > 30) p = 106.2 + (40 - tail) * 0.40; else p = 110.2 - (30 - tail) * 0.06 - Math.sin(i / 5) * 0.2; out.push({ t: t0 + i * 3600, o: p - 0.2, h: p + 0.35, l: p - 0.55, c: p, v: 700 + rnd() * 200 }); } return out; }
  const base = topTape(360, 2); const live0 = base[base.length - 1].c; const sh = S.opAssess(base, live0).filter(c => c.dir === 'short')[0];
  const t0 = base[base.length - 1].t;
  const swept = base.concat([{ t: t0 + 3600, o: live0, h: sh.zone.hi + 0.2, l: live0 - 0.3, c: sh.zone.lo + 0.05, v: 2400 }, { t: t0 + 7200, o: sh.zone.lo, h: sh.zone.lo + 0.2, l: sh.zone.lo - 1.1, c: sh.zone.lo - 0.9, v: 1900 }]);
  S.xuUniverse = () => Promise.resolve(UNI); S.xuCandles = () => Promise.resolve(swept);
  const ui = { btn: mk(), stat: mk(), cards: mk() }; await S.hgOpRunScan(ui);
  const recs = S.hgFwdRecords('OMNIPRESENT');
  ok(recs.length >= 1 && recs.every(r => r.reads && r.reads['ev:stretched'] === false && r.reads['gate:confluence3'] === false && r.reads['src:round number'] === true), 'driven through the real scan, every OMNIPRESENT record carries the reads: the fixture zone is a round-number zone with no stretched read and two sources (' + JSON.stringify(recs[0].reads) + ')');
  const trig = S.opAssess(swept, swept[swept.length - 1].c).filter(c => c.status === 'TRIGGERED')[0];
  const sortedJson = o => JSON.stringify(Object.keys(o).sort().reduce((a, k) => { a[k] = o[k]; return a; }, {}));
  ok(trig && sortedJson(S.opReadMarks(trig)) === sortedJson(recs[0].reads), 'card and record agree by construction: the record\'s reads are opReadMarks of the TRIGGERED candidate (the normaliser sorts keys)');
  ok(/forward \(settled\)/.test(ui.cards.innerHTML), 'the OMNIPRESENT board renders the forward column through the one renderer');
  const lone = boot(['hg-forward.js', 'omnipresent.js']);
  ok(typeof lone.opReadMarks === 'function' && lone.opReadMarks(trig) && lone.opReadMarks(trig)['ev:stretched'] === false, 'the marks need no renderer: with omniroute.js absent the desk still marks its records');
}

console.log('\n3. OMNIROUTE marks pillar reads from the compact stamp and live-fresh from hg-solidity\'s own gate');
{
  const S = boot(OMNI);
  const T = S.HG_OMNI_FACTOR_SEP;
  ok(T && T.tab === 'OMNIROUTE' && T.pillarHalf && typeof T.pillarHalf === 'object', 'the literal names its desk and carries pillarHalf');
  const inv = pillarInventory(omniLoadRows());
  ok(inv.varying.every(p => T.pillarHalf[p] === inv.max[p] / 2) && inv.starved.every(p => T.pillarHalf[p] === undefined), 'pillarHalf is half the replay max of every VARYING pillar and absent for the starved ones -- the bar the replay judged at, not a live re-derivation');
  ok(T.leans.indexOf('pillar:momentumConvergence:half') >= 0 && T.leans.indexOf('gate:liveFresh') >= 0 && T.leans.indexOf('grade:liveFresh') >= 0, 'the two hg-v987 leans named for a forward measurement are among the reads');
  const plan = { entry: 100, stop: 98, t1: 104, t2: 108 };
  const cand = (pillars, extra) => Object.assign({ dir: 'long', kind: 'X', plan, solidity: pillars ? { score: 100, maxScore: 200, tier: 'fair', pillars } : undefined }, extra || {});
  const P = { momentumConvergence: [8, 12], regime: [4, 10] };
  const mB = S.hgOmniReadMarks(cand({ momentumConvergence: [6, 12], regime: [5, 8] }), 100);
  ok(mB['pillar:momentumConvergence:half'] === true && mB['pillar:regime:half'] === true, 'a score exactly at the half clears it (at or over, as the generator picks it)');
  const mC = S.hgOmniReadMarks(cand({ momentumConvergence: [5, 8] }), 100);
  ok(mC['pillar:momentumConvergence:half'] === false, 'the bar is the REPLAY half (6), not half the stamp\'s own max (a 5/8 score would clear that and does not clear this)');
  const mD = S.hgOmniReadMarks({ dir: 'long', kind: 'X', plan: { entry: 100, stop: NaN, t1: 104 } }, 100);
  ok(mD === undefined || (mD['gate:liveFresh'] === undefined && mD['grade:liveFresh'] === undefined), 'a plan the grader cannot read (stop NaN, grade unknown) marks NO live-fresh read -- unknown is not false');
  const m1 = S.hgOmniReadMarks(cand(P), 100);
  ok(m1['pillar:momentumConvergence:half'] === true && m1['pillar:regime:half'] === false, 'pillar reads: 8/12 clears the replay half (6), 4/10 does not (5)');
  ok(m1['gate:liveFresh'] === true && m1['grade:liveFresh'] === true, 'livePx at entry: the G2 gate passes and the grade is FRESH');
  const m2 = S.hgOmniReadMarks(cand(P), 99);
  ok(m2['gate:liveFresh'] === true && m2['grade:liveFresh'] === false, 'livePx on the pullback side: G2 passes (pending), grade is not fresh -- the two reads differ, as the two replay rows do');
  const m3 = S.hgOmniReadMarks(cand(P), 105);
  ok(m3['gate:liveFresh'] === false && m3['grade:liveFresh'] === false, 'livePx past T1: G2 fails');
  const g = S.hgSolGateLiveFresh({ dir: 'long', entry: 100, stop: 98, t1: 104, t2: 108, livePx: 99 });
  ok(g.pass === m2['gate:liveFresh'] && (String(g.grade) === 'fresh') === m2['grade:liveFresh'], 'the mark IS hg-solidity\'s own G2 verdict on the same inputs (one rule)');
  const m4 = S.hgOmniReadMarks(cand(null), 100);
  ok(m4 && m4['pillar:momentumConvergence:half'] === undefined && m4['pillar:regime:half'] === undefined && m4['gate:liveFresh'] === true, 'no compact stamp (a non-ticket at record time): the pillar reads are ABSENT, the live-fresh reads still mark');
  const m5 = S.hgOmniReadMarks(cand(P), undefined);
  ok(m5 && m5['gate:liveFresh'] === undefined && m5['grade:liveFresh'] === undefined && m5['pillar:momentumConvergence:half'] === true, 'no livePx: the live-fresh reads are ABSENT (the gate says no-live, which is not a read), the pillar reads still mark');
  ok(S.hgOmniReadMarks({ dir: 'long' }, 100) === undefined && S.hgOmniReadMarks(null, 100) === undefined, 'no plan, no marks');
  const noSol = boot(OMNI.filter(f => f !== 'hg-solidity.js'));
  const m6 = noSol.hgOmniReadMarks(cand(P), 100);
  ok(m6 && m6['gate:liveFresh'] === undefined && m6['pillar:momentumConvergence:half'] === true, 'with hg-solidity.js absent the live-fresh read is ABSENT rather than re-derived here -- no second rule');
  /* the real scan: the census fixture */
  const UNI = [{ sym: 'HOTUSD', base: 'HOT', exchange: 'delta' }, { sym: 'WARMUSD', base: 'WARM', exchange: 'delta' }, { sym: 'COLDUSD', base: 'COLD', exchange: 'delta' }];
  S.xuUniverse = () => Promise.resolve(UNI); S.xuUniverseNote = () => null;
  S.xuCandles = (item, tf) => { const sec = tf === '1h' ? 3600 : tf === '15m' ? 900 : 14400; return Promise.resolve(tape(181, item.sym.length * 17, item.sym === 'HOTUSD' ? 0.002 : 0.0003, sec)); };
  S.binanceOIHistory = () => Promise.resolve({ series: [{ oi: 100 }, { oi: 110 }] }); S.binanceLongShort = () => Promise.resolve({ latest: { longShortRatio: 1.1 } }); S.binanceTakerRatio = () => Promise.resolve({ latest: { buySellRatio: 1.02 } }); S.binanceDepth = () => Promise.resolve({ bids: [[1, 1]], asks: [[2, 1]] });
  const ui = { btn: mk(), stat: mk(), warn: mk(), cards: mk(), pool: mk(), matrix: mk() }; await S.hgOmniRunScan(ui);
  const recs = S.hgFwdRecords('OMNIROUTE');
  const tickets = recs.filter(r => r.ticket), rest = recs.filter(r => !r.ticket);
  ok(recs.length >= 2 && tickets.length >= 1 && rest.length >= 1, 'the fixture records tickets and non-tickets (' + tickets.length + '/' + rest.length + ')');
  ok(recs.every(r => r.reads && typeof r.reads['gate:liveFresh'] === 'boolean' && typeof r.reads['grade:liveFresh'] === 'boolean'), 'every record carries the two live-fresh reads');
  ok(tickets.every(r => typeof r.reads['pillar:momentumConvergence:half'] === 'boolean' && typeof r.reads['pillar:regime:half'] === 'boolean'), 'every TICKET carries the pillar reads from the compact stamp the desk graded it with');
  ok(rest.every(r => r.reads['pillar:momentumConvergence:half'] === undefined), 'a non-ticket carries NO pillar read -- it is stamped late, after recording, and absent means absent');
  const stamp = S.hgOmniSolidityStamp({ dir: 'long', kind: 'VALUE', level: 100 }, { entry: 100, stop: 98, t1: 104, t2: 108, dir: 'long' }, tape(181, 7, 0.001, 3600), {}, null);
  ok(stamp && stamp.pillars && stamp.pillars.momentumConvergence[1] === 2 * T.pillarHalf.momentumConvergence && stamp.pillars.regime[1] === 2 * T.pillarHalf.regime, 'the live scorer\'s max for the two marked pillars is exactly twice the replay half (12 and 10): the same bar, live and replayed');
  ok(Object.keys(stamp.pillars).length === 18 && Object.keys(stamp.pillars).every(k => Array.isArray(stamp.pillars[k]) && stamp.pillars[k].length === 2), 'the compact stamp carries eighteen [score, max] pairs and no detail strings');
  ok(/forward \(settled\)/.test(ui.pool.innerHTML) && !/FORWARD<\/b>/.test(ui.pool.innerHTML), 'the pool renders the forward column, and no FORWARD line while nothing has settled');
  /* settle the records and render again: replay beside forward */
  const sec = 14400;
  for (const r of recs) S.hgFwdResolve(r.sym, '4h', [{ t: r.barT + sec, o: r.entry, h: r.dir === 'long' ? r.t1 * 1.01 : r.entry * 1.001, l: r.dir === 'long' ? r.entry * 0.999 : r.t1 * 0.99, c: r.t1 }]);
  const settled = S.hgFwdRecords('OMNIROUTE').filter(r => r.state === 't1' || r.state === 'stop').length;
  ok(settled === recs.length, 'all ' + settled + ' fixture records settle on the next bar');
  const h = S.hgOmniFactorSepHtml();
  ok(/FORWARD<\/b> · ' + settled + ' of ' + settled + ' settled forward records/.test(h.replace(/&#39;|’/g, "'")) || new RegExp('FORWARD</b> · ' + settled + ' of ' + settled + ' settled').test(h), 'the renderer says how many settled records carry marks');
  const rowOf = (key) => { const i = h.indexOf('<td>' + key + '</td>'); return h.slice(i, h.indexOf('</tr>', i)); };
  ok(/carried \+[\d.]+R at [\d.]+% n=\d+|not \+[\d.]+R at [\d.]+% n=\d+/.test(rowOf('gate:liveFresh')), 'the gate:liveFresh row carries the forward count beside the replay figures (' + text(rowOf('gate:liveFresh')).slice(-60) + ')');
  ok(/<td>—<\/td>$/.test(rowOf('session:ASIA')) && rowOf('session:ASIA').length > 40, 'a read this desk does not mark shows an empty forward cell, never a fabricated count');
  ok(/REPLAY READ SPLIT/.test(S.hgFwdPanelHTML('OMNIROUTE', { minRr: 2 })), 'the shared forward panel prints the split on this desk');
  ok(S.hgFwdReadSplit('OMNIROUTE').reads['gate:liveFresh'].yes.n + S.hgFwdReadSplit('OMNIROUTE').reads['gate:liveFresh'].no.n === settled, 'the split\'s live-fresh cohorts partition the settled records');
}

console.log('\n4. nothing is gated; the literals round-trip; the reads are read where they should be');
{
  ok(omniSplice(read('omniroute.js'), omniLiteral(omniRun())) === read('omniroute.js'), 'HG_OMNI_FACTOR_SEP round-trips (zero drift) with tab and pillarHalf');
  ok(opSplice(read('omnipresent.js'), opLiteral(opRun())) === read('omnipresent.js'), 'HG_OP_FACTOR_SEP round-trips (zero drift) with tab');
  const fwd = stripComments(read('hg-forward.js'));
  ok(!/reads\[/.test(fwd.split('W.hgFwdReadSplit = function')[0].replace(/function hgFwdReadsNormalize[\s\S]*?\n  }\n/, '').replace(/if \(r\.reads && typeof r\.reads === 'object'\)\{[\s\S]*?\n      \}\n/, '')), 'inside hg-forward.js nothing before the split reader indexes into reads except the normaliser and the fold (textual)');
  for (const f of ['hg-gates.js', 'hg-solidity.js', 'hg-plan.js']) ok(!/\.reads\b/.test(stripComments(read(f))), f + ' never reads the marks -- no gate is fed by them');
  const om = stripComments(read('omniroute.js'));
  ok((om.match(/hgOmniReadMarks\(/g) || []).length === 2 && /window\.hgOmniReadMarks = hgOmniReadMarks;/.test(om), 'omniroute.js calls hgOmniReadMarks at the record site and nowhere else (the definition, the call, and a bare export)');
  ok(/reads: hgOmniReadMarks\(found\[k\], held\[j\]\.livePx\),/.test(om), 'on the same livePx the mark reads');
  const op = stripComments(read('omnipresent.js'));
  ok((op.match(/opReadMarks\(/g) || []).length === 2 && /reads: opReadMarks\(c\) \}; \}\);/.test(op) && /window\.opReadMarks = opReadMarks;/.test(op), 'omnipresent.js calls opReadMarks at the record site and nowhere else (definition, call, bare export)');
}

console.log('\n5. version stamps');
{
  const bs = read('build-stamp.js');
  ok(/version: 'hg-v989'/.test(bs), 'build-stamp.js is hg-v989');
  ok(swCacheOk(read('sw.js')), 'sw.js cache matches');
}

console.log('\n' + passed + ' assertions passed');
