/* HARDGATE — the desk ranks its cards and has never checked the ranking.

   hgOgBalanceParts decides which gold setup a reader sees first. It has
   done so since it was written — tape, family agreement, indicator net,
   coverage, proximity, freshness, live-price sanity, measured edge — and
   NOTHING recorded it. So "did the card we put at the top do better than
   the one we put fifth?" has never been askable, on a desk that has spent
   this whole run of work making every other claim testable.

   Two things here.

   THE SCORE IS RECORDED, at fire time, from the same function the renderer
   sorts on — without a tape side, because tape is unresolved at that point
   in the scan and a tape-dependent score is not comparable across bars. The
   tape term then contributes 0 to every card equally and what separates
   them is everything else.

   AND THE INERT TERM IS NAMED. ticketN carries the largest weight here
   (120) to hold tickets above watches. Since hg-v756 made measured-edge
   hard, no card is a ticket, so it has been 0 for every card on every scan.
   A constant changes no ordering, so nothing is broken — but the note on
   the function still described a scheme where ticket dominates, and the
   ordering that actually decides a book of pure WATCH cards was tuned when
   that term did the heavy lifting and has not been looked at since.

   Run: node tests/test-omnigold-rank-recorded.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const store = {};
const doc = { getElementById: () => null, createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }),
              querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
              body: { appendChild(){} }, addEventListener(){} };
const ctx = { console, Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array,
              JSON, Date, RegExp, document: doc, setTimeout: () => 0, clearTimeout: () => {},
              addEventListener: () => {}, fetch: () => Promise.reject(new Error('no net')),
              localStorage: { getItem: k => (k in store ? store[k] : null),
                              setItem: (k, v) => { store[k] = String(v); },
                              removeItem: k => { delete store[k]; } } };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'hg-forward.js', 'plans.js', 'hg-plan.js',
                 'hg-gates.js', 'omniroute.js', 'omnigold.js']){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* optional deps degrade */ }
}
const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');

console.log('== the ranker still ranks, and the ticket term is inert ==');
{
  const B = ctx.hgOgBalanceParts;
  ok(typeof B === 'function', 'hgOgBalanceParts is the ranker and is exported');

  const card = (o) => Object.assign({ dir: 'long', gates: [], grade: { total: 10, evaluated: 8 } }, o);

  /* a ticket would have carried +120; nothing is a ticket now, so the term
     contributes nothing and cannot be what separates two cards */
  const asTicket = B(card({ grade: { total: 10, evaluated: 8, ticket: true } }), '');
  const asWatch  = B(card({ grade: { total: 10, evaluated: 8, ticket: false } }), '');
  ok(asTicket.ticket === 1 && asWatch.ticket === 0, 'the term still exists and still reads the grade');
  ok(Math.abs((asTicket.score - asWatch.score) - 120) < 1e-9,
     'and is still worth 120 the moment a ticket returns — it is inert, not removed');

  ok(/THE 120 IS INERT WHILE THE EDGE GATE IS HARD/.test(SRC),
     'and the source says so where the weights are, not in a commit message');
  ok(/hgOgDeskOrder's section key carries the same inert/.test(SRC),
     'including the second place the same dead term appears');
}

console.log('\n== the score that orders a card is the score recorded ==');
{
  ok(/balScore: \(function\(\)\{/.test(SRC), 'the recorder computes it at fire time');
  ok(/hgOgBalanceParts\(c, ''\)/.test(SRC),
     'from the same function the renderer sorts on, with no tape side');
  /* a tape-dependent score is not comparable across bars: the same card
     scores 100 higher on a day the tape agrees with it */
  const c = { dir: 'long', gates: [], grade: { total: 10, evaluated: 8 } };
  const withTape = ctx.hgOgBalanceParts(c, 'long').score;
  const noTape = ctx.hgOgBalanceParts(c, '').score;
  ok(Math.abs((withTape - noTape) - 100) < 1e-9,
     'which matters: a tape side moves the score by 100, swamping every other term');
}

console.log('\n== the log carries it, and absent is not zero ==');
{
  const N = ctx.hgFwdNormalize;
  const base = { tab: 'OMNIGOLD:SCALP', mechanic: 'MMOVE', sym: 'XAUUSD', tf: '1h', dir: 'long',
                 entry: 4700, stop: 4670, t1: 4760, barT: 1700000000, horizonBars: 24 };
  ok(N(Object.assign({}, base, { balScore: 77 })).balScore === 77, 'a score is kept');
  ok(N(Object.assign({}, base, { balScore: 0 })).balScore === 0, 'and zero is a real score, kept as one');
  ok(N(base).balScore === undefined,
     'while a tab that does not rank records undefined — never a fabricated 0');
  ok(N(Object.assign({}, base, { balScore: 'high' })).balScore === undefined,
     'and a non-numeric score is absent, not coerced');
}

console.log('\n== settled outcomes split by where the desk ranked them ==');
{
  const S = ctx.hgFwdStatsOf, N = ctx.hgFwdNormalize;
  const mk = (i, o) => Object.assign(N({ tab: 'OMNIGOLD:SCALP', mechanic: 'MMOVE', sym: 'XAUUSD',
    tf: '1h', dir: 'long', entry: 4700, stop: 4670, t1: 4760,
    barT: 1700000000 + i * 3600, horizonBars: 24, balScore: o.balScore }), o);

  const list = [mk(0, { balScore: 140, state: 't1' }), mk(1, { balScore: 120, state: 'stop' }),
                mk(2, { balScore: 40, state: 't1' }),  mk(3, { balScore: -30, state: 'stop' }),
                mk(4, { state: 't1' })];
  const st = S(list, 'OMNIGOLD:SCALP', 'MMOVE', false, null);

  ok(st.byBal, 'the stats carry a rank-score breakdown');
  ok(st.byBal.top.n === 2 && st.byBal.top.w === 1, 'the top bucket counts 2, one of them a win');
  ok(st.byBal.mid.n === 1 && st.byBal.low.n === 1, 'and the middle and bottom buckets separate');
  const bucketed = st.byBal.top.n + st.byBal.mid.n + st.byBal.low.n;
  ok(bucketed === 4 && st.samples === 5,
     'the unscored record is in the totals but in NO bucket — it has no rank to be judged by');

  /* the whole point: the buckets must be able to say the ranking is
     backwards, not only that it is right */
  ok(st.byBal.top.w / st.byBal.top.n < st.byBal.mid.w / st.byBal.mid.n,
     'and on this fixture the top bucket does WORSE — the breakdown can report against the desk');
}

console.log('\n== this is a measurement, not a re-tuning ==');
{
  /* Nothing about the ordering changed. The session that found the stop
     floor fitted to one end of an interval does not get to re-weight a
     ranker on evidence it cannot check. */
  ok(/100 \* tapeScore/.test(SRC) && /30 \* family/.test(SRC) && /30 \* infoRatio/.test(SRC),
     'every weight is exactly as it was');
  ok(/25 \* edgeN/.test(SRC) && /40 \* edgeDemoteN/.test(SRC), 'including the edge pair');
  ok(/A number, not a claim/.test(SRC),
     'and the recorder says it is recording a number rather than asserting one');
}

console.log('\n' + passed + ' passed, 0 failed');
