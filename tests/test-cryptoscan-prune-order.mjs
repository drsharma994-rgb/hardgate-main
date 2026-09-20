/* HARDGATE — pruning destroyed the evidence it promised to preserve.

   hg-forward caps its record list at MAX_RECORDS and prunes oldest-first,
   with the stated bargain: "FOLD the dropped records' outcomes into the
   aggregate first, so pruning costs detail and never evidence."

   That holds for a SETTLED record. Its wins, losses and rrSum survive uncapped
   in the aggregate and only the detail is lost. It does NOT hold for an OPEN
   one. hgFwdFold folds outcomes, and an open record has none, so pruning it
   does not coarsen the evidence -- it destroys it. The trade never settles and
   never counts anywhere.

   Oldest-first is exactly the wrong order for that, because the records still
   waiting are by definition the old ones.

   CRYPTO SCAN made it concrete. It writes one row per setup per 15m bar across
   the whole Delta + CoinDCX universe, into a cap shared by every instrumented
   tab:

      10 setups/bar     960 rows/day   a record survives ~100h
      20 setups/bar   1,920 rows/day   ~50h
      50 setups/bar   4,800 rows/day   ~20h
     100 setups/bar   9,600 rows/day   ~10h

   against a cap the file's own comment sizes for "a conservative 150
   records/day across ~20 instrumented tabs". A 4h/20-bar gold setup needs 80
   HOURS of bars before it can settle; a 4h/24 desk needs 96; a daily desk 240.
   Driven through the real recorder: one open OMNIGOLD MMOVE record, then 40h
   of CRYPTO SCAN at 50 setups/bar. Before this change the gold record was gone
   and the aggregate was empty. Not coarsened -- lost.

   Pruning now takes what the aggregate can absorb first: settled records, then
   ones already past their own horizon, and only then -- if the cap still is
   not met -- an open record still inside its horizon. Oldest-first within each
   group, as before. No cap, threshold or timeframe moves.

   Run: node tests/test-cryptoscan-prune-order.mjs */
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

function boot(){
  const s = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
              Math, isFinite, isNaN, Number, String, Object, Array, JSON, Date,
              parseInt, parseFloat, NaN, Infinity, RegExp, Promise, Error, Set, Map };
  s.window = s; s.globalThis = s; s.self = s;
  s.setTimeout = () => 0; s.clearTimeout = () => {};
  s.setInterval = () => 0; s.clearInterval = () => {};
  s.document = { getElementById: () => null, querySelector: () => null, addEventListener(){} };
  s.localStorage = (() => { const m = {}; return {
    getItem: k => (k in m ? m[k] : null), setItem(k, v){ m[k] = String(v); },
    removeItem(k){ delete m[k]; } }; })();
  s.location = { href: 'https://x/' }; s.navigator = { userAgent: 'node' };
  vm.createContext(s);
  vm.runInContext(fs.readFileSync(root + 'hg-forward.js', 'utf8'), s, { filename: 'hg-forward.js' });
  return s;
}
const S = boot();
const FWD = fs.readFileSync(root + 'hg-forward.js', 'utf8');
const SEC = 900, H4 = 14400;
const NOW = Math.floor(Date.now() / 1000);
const CAP = (() => {
  const m = /var MAX_RECORDS = (\d+);/.exec(FWD);
  return m ? +m[1] : 0;
})();

function wipe(){ S.localStorage.removeItem('hg_forward_v1'); S.localStorage.removeItem('hg_forward_agg_v1'); }
function live(){ const j = JSON.parse(S.localStorage.getItem('hg_forward_v1') || '{}'); return j.rows || j || []; }

/* ---------------------------------------------------------------- 1
   hgFwdIsPastHorizon: has this record got anything left to wait for? */
{
  const P = S.hgFwdIsPastHorizon;
  ok(typeof P === 'function', 'hgFwdIsPastHorizon is exported');
  ok(CAP > 0, 'MAX_RECORDS is readable from the source (' + CAP + ')');

  const open = (ageSec, tf, hb) => ({ state: 'open', tf: tf, horizonBars: hb, barT: NOW - ageSec });
  ok(P(open(3600, '4h', 20), NOW) === false, 'a 4h/20 record one hour old is still owed bars');
  ok(P(open(79 * 3600, '4h', 20), NOW) === false, 'and at 79 of its 80 hours, still owed');
  ok(P(open(81 * 3600, '4h', 20), NOW) === true, 'at 81 hours its horizon has passed');
  ok(P(open(7 * 3600, '15m', 24), NOW) === true, 'a 15m/24 record is past its 6h horizon at 7h');
  ok(P(open(5 * 3600, '15m', 24), NOW) === false, 'but not at 5h');

  ok(P({ state: 't1', tf: '4h', horizonBars: 20, barT: NOW }, NOW) === true,
     'a SETTLED record has nothing left to wait for, whatever its age');
  ok(P({ state: 'stop', tf: '4h', horizonBars: 20, barT: NOW }, NOW) === true, 'either outcome');

  /* absent means droppable, not pinned: a record that cannot say when it
     fired cannot be shown to be still waiting */
  ok(P({ state: 'open', tf: '4h', horizonBars: 20 }, NOW) === true, 'no bar stamp, droppable');
  ok(P({ state: 'open', tf: '4h', barT: NOW }, NOW) === true, 'no horizon, droppable');
  ok(P({ state: 'open', tf: '4h', horizonBars: 0, barT: NOW }, NOW) === true, 'zero horizon, droppable');
  ok(P(null, NOW) === true, 'and a missing record does not throw');

  /* it is the TIGHTER question than hgFwdIsStale, which allows 3 horizons */
  const r = open(100 * 3600, '4h', 20);
  ok(P(r, NOW) === true && S.hgFwdIsStale(r, NOW) === false,
     'past its horizon at 100h, but not yet stale — the two ask different questions');
}

/* ---------------------------------------------------------------- 2
   THE REPRO. A slow horizon survives a fast tab's flood. */
{
  wipe();
  const HOURS = 40, bars = HOURS * 4, K = 50;
  const lastBar = Math.floor(NOW / SEC) * SEC - SEC;
  const start = lastBar - (bars - 1) * SEC;
  const goldBar = Math.floor((start - H4) / H4) * H4;

  S.hgFwdRecordScan('OMNIGOLD', '4h',
    [{ sym: 'XAUUSD', dir: 'long', mechanic: 'MMOVE', entry: 2400, stop: 2380, t1: 2430,
       mark: 2400, barT: goldBar }], { horizonBars: 20 });
  ok(live().length === 1, 'the gold desk records one open 4h/20-bar setup');
  const goldAgeH = (NOW - goldBar) / 3600;
  ok(goldAgeH < 80, 'it fired ' + goldAgeH.toFixed(0)
     + 'h ago, inside its own 80h horizon, so it is still owed bars');

  for (let b = 0; b < bars; b++){
    const batch = [];
    for (let i = 0; i < K; i++)
      batch.push({ sym: 'C' + i, dir: 'long', mechanic: 'VOTE-STRONG@V5',
                   entry: 100, stop: 95, t1: 107.5, mark: 100, barT: start + b * SEC });
    S.hgFwdRecordScan('CRYPTO SCAN', '15m', batch, { horizonBars: 24 });
  }

  const rows = live();
  ok(rows.length === CAP, 'CRYPTO SCAN wrote ' + (K * bars).toLocaleString()
     + ' rows and the list is at the cap (' + rows.length + ')');
  ok(rows.filter(r => r.tab === 'OMNIGOLD').length === 1,
     'and the gold record SURVIVED');

  /* oldest-first would have taken it: it is the oldest row in the list */
  const oldest = rows.concat().sort((a, b) => a.barT - b.barT)[0];
  ok(oldest.tab === 'OMNIGOLD',
     'it is the oldest row present, which is exactly what oldest-first drops first');

  const owed = rows.filter(r => !S.hgFwdIsPastHorizon(r, NOW)).length;
  ok(owed > 0 && owed < rows.length,
     owed + ' of ' + rows.length + ' rows are still inside their own horizon');
  ok(rows.length - owed > 0, 'and ' + (rows.length - owed)
     + ' are past it — droppable without losing a trade');
}

/* ---------------------------------------------------------------- 3
   Order: settled goes before open, however old each is. */
{
  const A = S.hgFwdAdd;
  ok(typeof A === 'function', 'hgFwdAdd is exported pure');

  /* a full list: one OLD settled row and the rest young and open */
  const list = [];
  list.push({ tab: 'T', mechanic: 'M', sym: 'OLD-SETTLED', dir: 'long', tf: '4h',
              horizonBars: 20, barT: NOW - 500 * 3600, state: 't1', entry: 1, stop: 0.9, t1: 1.2 });
  for (let i = 1; i < CAP; i++)
    list.push({ tab: 'T', mechanic: 'M', sym: 'Y' + i, dir: 'long', tf: '4h', horizonBars: 20,
                barT: NOW - 3600, state: 'open', entry: 1, stop: 0.9, t1: 1.2 });

  const res = A(list, { tab: 'T', mechanic: 'M', sym: 'NEW', dir: 'long', tf: '4h',
                        horizonBars: 20, barT: NOW, entry: 1, stop: 0.9, t1: 1.2 });
  ok(res.added === true, 'one more record is added');
  ok(res.list.length === CAP, 'the list stays at the cap');
  ok(res.list.filter(r => r.sym === 'OLD-SETTLED').length === 0,
     'the settled record is what went — its outcome survives in the aggregate');
  ok(res.folded && res.folded.length === 1 && res.folded[0].sym === 'OLD-SETTLED',
     'and it is handed back to be folded');
  ok(res.list.filter(r => r.sym === 'NEW').length === 1, 'the new record is kept');

  /* now with NO settled rows, but some already past their horizon */
  const list2 = [];
  list2.push({ tab: 'T', mechanic: 'M', sym: 'PAST-HORIZON', dir: 'long', tf: '15m',
               horizonBars: 24, barT: NOW - 40 * 3600, state: 'open', entry: 1, stop: 0.9, t1: 1.2 });
  for (let i = 1; i < CAP; i++)
    list2.push({ tab: 'T', mechanic: 'M', sym: 'Z' + i, dir: 'long', tf: '4h', horizonBars: 20,
                 barT: NOW - 3600, state: 'open', entry: 1, stop: 0.9, t1: 1.2 });
  const res2 = A(list2, { tab: 'T', mechanic: 'M', sym: 'NEW2', dir: 'long', tf: '4h',
                          horizonBars: 20, barT: NOW, entry: 1, stop: 0.9, t1: 1.2 });
  ok(res2.list.filter(r => r.sym === 'PAST-HORIZON').length === 0,
     'with nothing settled, the one already past its horizon goes next');
  ok(res2.list.filter(r => r.sym === 'NEW2').length === 1, 'and the new record is kept');

  /* OLDEST-FIRST *WITHIN* THE DROPPABLE GROUP. Every fixture above has a
     single droppable row, so oldest and newest coincide and a prune that took
     the newest would pass unnoticed — a mutation proved exactly that. Here
     five settled rows of different ages compete, and three have to go. */
  const listAges = [];
  for (let i = 0; i < 5; i++)
    listAges.push({ tab: 'T', mechanic: 'M', sym: 'SET' + i, dir: 'long', tf: '4h',
                    horizonBars: 20, barT: NOW - (500 - i) * 3600, state: 't1', rr: 1.5,
                    entry: 1, stop: 0.9, t1: 1.2 });
  for (let i = 5; i < CAP + 2; i++)
    listAges.push({ tab: 'T', mechanic: 'M', sym: 'OPEN' + i, dir: 'long', tf: '4h',
                    horizonBars: 20, barT: NOW - 3600, state: 'open', entry: 1, stop: 0.9, t1: 1.2 });
  const resAges = A(listAges, { tab: 'T', mechanic: 'M', sym: 'NEWEST', dir: 'long', tf: '4h',
                                horizonBars: 20, barT: NOW, entry: 1, stop: 0.9, t1: 1.2 });
  ok(resAges.list.length === CAP, 'three rows had to go to reach the cap');
  ok(resAges.folded.length === 3, 'and three were dropped (' + resAges.folded.length + ')');
  const goneSyms = resAges.folded.map(r => r.sym).sort().join(',');
  ok(goneSyms === 'SET0,SET1,SET2',
     'the THREE OLDEST settled rows went, not the newest three (' + goneSyms + ')');
  ok(resAges.list.filter(r => r.sym === 'SET3').length === 1
     && resAges.list.filter(r => r.sym === 'SET4').length === 1,
     'the two newer settled rows stayed');
  ok(resAges.list.filter(r => String(r.sym).indexOf('OPEN') === 0).length === CAP - 3,
     'and every open row is untouched');

  /* LAST RESORT: when every row is open and inside its horizon, the oldest
     of those goes — the cap is still a cap */
  const list3 = [];
  for (let i = 0; i < CAP; i++)
    list3.push({ tab: 'T', mechanic: 'M', sym: 'W' + i, dir: 'long', tf: '4h', horizonBars: 20,
                 barT: NOW - (CAP - i) * 60, state: 'open', entry: 1, stop: 0.9, t1: 1.2 });
  const res3 = A(list3, { tab: 'T', mechanic: 'M', sym: 'NEW3', dir: 'long', tf: '4h',
                          horizonBars: 20, barT: NOW, entry: 1, stop: 0.9, t1: 1.2 });
  ok(res3.list.length === CAP, 'the cap is still enforced when nothing is droppable');
  ok(res3.list.filter(r => r.sym === 'W0').length === 0, 'and the oldest owed row is the one taken');
  ok(res3.list.filter(r => r.sym === 'W1').length === 1, 'the next-oldest stays');
  ok(res3.folded && res3.folded.length === 1 && res3.folded[0].sym === 'W0',
     'it is still reported as folded, so nothing is dropped silently');
}

/* ---------------------------------------------------------------- 4
   The original bargain is intact: a pruned SETTLED record still reaches the
   aggregate, so its evidence survives even though its detail does not. Tested
   through the module's own pure pair — hgFwdAdd hands back what it dropped,
   hgFwdFold turns that into counts — rather than through storage, which
   prunes on write and would settle the rows after the fact. */
{
  const list = [];
  for (let i = 0; i < CAP; i++){
    const settled = i < 3;                     /* the three OLDEST are settled */
    list.push({ tab: 'OMNIGOLD', mechanic: 'MMOVE', sym: 'S' + i, dir: 'long', tf: '4h',
                horizonBars: 20, barT: NOW - (CAP - i) * 60,
                state: settled ? 't1' : 'open', rr: settled ? 1.5 : undefined,
                entry: 100, stop: 95, t1: 107.5 });
  }
  const res = S.hgFwdAdd(list, { tab: 'OMNIGOLD', mechanic: 'MMOVE', sym: 'NEW4', dir: 'long',
                                 tf: '4h', horizonBars: 20, barT: NOW,
                                 entry: 100, stop: 95, t1: 107.5 });
  ok(res.list.length === CAP, 'the list is held at the cap');
  ok(res.folded && res.folded.length === 1, 'exactly one record was dropped');
  ok(res.folded[0].state === 't1',
     'and it is a SETTLED one, not the open rows that are just as old');

  const agg = S.hgFwdFold({}, res.folded);
  const key = Object.keys(agg)[0];
  ok(!!key && /OMNIGOLD/.test(key), 'folding it produces an aggregate entry (' + key + ')');
  ok(agg[key].wins === 1,
     'carrying its win (' + agg[key].wins + ') — detail lost, evidence kept');

  /* and the open rows that were NOT dropped carry nothing foldable, which is
     precisely why dropping them would have destroyed rather than coarsened */
  const openAgg = S.hgFwdFold({}, res.list.filter(r => r.state === 'open').slice(0, 5));
  ok(Object.keys(openAgg).length === 0 || !Object.keys(openAgg).some(k => openAgg[k].wins),
     'an open record folds to nothing — there is no outcome to preserve');
}

/* ---------------------------------------------------------------- 5
   Nothing else moved. */
{
  const bare = stripComments(FWD);
  ok(/var MAX_RECORDS = 4000;/.test(bare), 'the cap itself is unchanged');
  ok(/var STALE_HORIZONS = 3;/.test(bare), 'and so is the staleness rule');
  ok(/hgFwdIsPastHorizon\(r, nowSec\)/.test(bare), 'the prune consults the horizon');
  ok(/giveable\.sort\(byBar\)/.test(bare) && /owed\.sort\(byBar\)/.test(bare),
     'and still sorts oldest-first inside each group');
  /* two redundancies that mutations exposed in the first version of this
     change, removed rather than tested around: a `state` branch that
     hgFwdIsPastHorizon already answered, and a re-sort of the kept list that
     maintained an invariant holding only just after a prune and that no
     reader relies on. */
  ok(!/r\.state && r\.state !== 'open'\) giveable\.push/.test(bare),
     'the redundant state branch in the prune is gone');
  ok(!/keep\.sort\(byBar\)/.test(bare), 'and so is the re-sort of the kept list');
  ok(!/out\.sort\(function\(a, b\)\{ return num\(a\.barT\) - num\(b\.barT\); \}\);\s*var dropped = out\.slice\(0, out\.length - MAX_RECORDS\);/.test(bare),
     'the flat oldest-first prune is gone');
}

console.log('\n' + passed + ' assertions'
  + (process.exitCode ? ' — WITH FAILURES' : ' — all green'));
