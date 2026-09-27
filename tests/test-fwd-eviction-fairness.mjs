/* HARDGATE — when the forward ledger overflows its cap on OPEN records,
   the flooder must eat its own pending records, not the slow pools' (hg-v1000).

   THE DEFECT. hgFwdAdd prunes in two groups: records past their horizon
   first (their outcomes survive in the aggregate), and only then records
   still OPEN inside their horizon — "owed" — because an open record pruned
   is evidence destroyed, not coarsened. But the owed group was evicted
   oldest-barT-first, and the oldest rows in it are always the SLOW pools':
   an 80h CARD/BEST 4h record is older than every 6h 15m record by
   construction. Two hot 15m tabs at the documented ~90 setups/bar each owe
   ~4,300 records at any moment — over the 4,000 cap on their own — and the
   first thing the old rule destroyed was the scarce 80h evidence the
   proven-edge gate reads, by volume the slow pools never produced.

   THE RULE NOW: inside the owed group, the LARGEST tab gives up its own
   oldest pending records first; a small pool loses nothing until the
   flooder's excess is exhausted.

   This file drives the REAL hgFwdAdd/hgFwdSettle through that flood: 25
   slow CARD:swing records plus two 15m tabs at 90 setups/bar, time walked
   forward bar by bar. Pre-fix the CARD records are evicted open within
   hours; post-fix they all survive to settle.

   Run: node tests/test-fwd-eviction-fairness.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

/* Walked-forward clock: hg-forward.js reads Date.now() in exactly one place
   that matters here (the prune's nowSec), and this is the honest way to
   simulate three weeks of scanning in a second. */
let NOW_SEC = 1700000000;
function boot(){
  const ctx = { console, Math, JSON, Array, Object, String, Number, isFinite, parseFloat, parseInt,
                Date: { now: () => NOW_SEC * 1000 } };
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8'), ctx, { filename: 'hg-forward.js' });
  return ctx;
}

const BAR15 = 900;
const FLOOD_PER_BAR = 90;          /* per tab — the documented heavy rate */
const CARD_N = 25;

console.log('== the flood: two hot 15m tabs + one slow 4h pool, three weeks of bars ==');
{
  const W = boot();
  const CAP = W.HG_FWD_MAX;
  ok(CAP === 4000, 'the cap this simulation stresses is 4000 (got ' + CAP + ')');
  let list = [];
  const add = (rec) => { list = W.hgFwdAdd(list, rec).list; };

  /* bar 0: the slow pool writes its records — an 80h horizon each */
  for (let k = 0; k < CARD_N; k++){
    add({ tab: 'CARD:swing', mechanic: 'SWING', sym: 'CARDSYM' + k, tf: '4h', dir: 'long',
          entry: 100, stop: 90, t1: 115, barT: NOW_SEC, horizonBars: 20 });
  }

  /* 30h of 15m bars, each carrying 180 flood records (90 per tab) */
  const BARS = 120;
  let capBreached = false;
  for (let b = 1; b <= BARS; b++){
    NOW_SEC += BAR15;             /* time really does pass */
    for (let k = 0; k < FLOOD_PER_BAR; k++){
      add({ tab: 'CRYPTO SCAN', mechanic: 'FLOOD', sym: 'FA' + k, tf: '15m', dir: 'long',
            entry: 100, stop: 90, t1: 115, barT: NOW_SEC, horizonBars: 24 });
      add({ tab: 'CRYPTOVERSE', mechanic: 'FLOOD', sym: 'FB' + k, tf: '15m', dir: 'long',
            entry: 100, stop: 90, t1: 115, barT: NOW_SEC, horizonBars: 24 });
    }
    if (list.length > CAP) throw new Error('the cap itself did not hold: ' + list.length);
    if (list.length === CAP) capBreached = true;
  }
  ok(capBreached, 'the flood really did drive the ledger to its cap (otherwise this test proves nothing)');

  /* THE ASSERTION THE WHOLE FILE EXISTS FOR: the slow pool's open records
     survived the flood. */
  const cardStats = W.hgFwdStatsOf(list, 'CARD:swing', 'SWING', false, null);
  ok(cardStats.open === CARD_N,
    'all ' + CARD_N + ' slow 80h-horizon records are still open after the flood (pre-fix: evicted within hours — got open=' + cardStats.open + ')');

  /* and the eviction really did come out of the flooders' own pending rows */
  const fa = W.hgFwdStatsOf(list, 'CRYPTO SCAN', 'FLOOD', false, null);
  const fb = W.hgFwdStatsOf(list, 'CRYPTOVERSE', 'FLOOD', false, null);
  const floodOpen = fa.open + fb.open;
  const floodWritten = BARS * FLOOD_PER_BAR * 2;
  ok(floodOpen < floodWritten,
    'the flooders did lose pending records — their own (' + floodOpen + ' of ' + floodWritten + ' survive)');
  ok(floodOpen + CARD_N <= CAP && list.length <= CAP, 'the cap holds with the slow pool intact inside it');

  /* survived means SETTLEABLE: hand the card symbols their bars now */
  let settled = 0;
  const winRows = [];
  for (let k = 1; k <= 3; k++) winRows.push({ t: NOW_SEC + k * 14400, o: 100, h: k === 1 ? 116 : 101, l: 99, c: 100, v: 1 });
  for (let k = 0; k < CARD_N; k++){
    const r = W.hgFwdSettle(list, 'CARDSYM' + k, '4h', winRows);
    list = r.list; settled += r.changed;
  }
  ok(settled === CARD_N, 'every surviving slow record now settles (' + settled + '/' + CARD_N + ')');
  const afterSettle = W.hgFwdStatsOf(list, 'CARD:swing', 'SWING', false, null);
  ok(afterSettle.samples === CARD_N && afterSettle.wins === CARD_N,
    'and the pool the proven-edge gate reads finally has its samples (n=' + afterSettle.samples + ')');
}

console.log('== the older rule still holds: settled/past-horizon rows go before ANY open one ==');
{
  const W = boot();
  let list = [];
  const add = (rec) => { list = W.hgFwdAdd(list, rec).list; };
  /* one settled slow record + cap-1 fresh open flood records; one more add
     must evict the settled one, never an open one */
  add({ tab: 'OLDTAB', mechanic: 'M', sym: 'OLDSYM', tf: '4h', dir: 'long',
        entry: 100, stop: 90, t1: 115, barT: NOW_SEC - 200 * 14400, horizonBars: 20 });
  const rows = [];
  for (let k = 1; k <= 3; k++) rows.push({ t: NOW_SEC - 199 * 14400 + k * 14400, o: 100, h: k === 1 ? 116 : 101, l: 99, c: 100, v: 1 });
  list = W.hgFwdSettle(list, 'OLDSYM', '4h', rows).list;
  for (let k = 0; k < W.HG_FWD_MAX - 1; k++){
    add({ tab: 'FLOODTAB', mechanic: 'M', sym: 'FSYM' + k, tf: '15m', dir: 'long',
          entry: 100, stop: 90, t1: 115, barT: NOW_SEC, horizonBars: 24 });
  }
  ok(list.length === W.HG_FWD_MAX, 'ledger at the cap, one settled + the rest open');
  add({ tab: 'FLOODTAB', mechanic: 'M', sym: 'FSYMX', tf: '15m', dir: 'long',
        entry: 100, stop: 90, t1: 115, barT: NOW_SEC, horizonBars: 24 });
  const gone = list.filter(r => r.sym === 'OLDSYM').length === 0;
  ok(gone, 'the settled record was the one folded out — its outcome survives in the aggregate, an open one would be destroyed');
  ok(list.length === W.HG_FWD_MAX, 'still exactly at the cap');
}

console.log('\n' + passed + ' checks passed');
console.log('ALL EVICTION-FAIRNESS TESTS PASSED');
