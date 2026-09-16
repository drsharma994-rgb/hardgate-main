/* HARDGATE — the desk published 48.8 cards a day for one instrument.

   A reader holds one gold position. The walk shows a time-weighted mean of
   55 open at once, and 77% of same-bar same-direction duplicates settle
   IDENTICALLY — the same trade wearing two mechanic names.

   Two rules cut it. ogTradeKey gains a proportional tolerance on a shared
   log grid, so levels within ~0.1% are one trade instead of two cards —
   with a stated limit, asserted below: a pair straddling a bucket edge
   still keys apart, which costs an extra card and never a wrong merge.
   hgOgLaneThrottle drops a card into a lane whose previous card is still
   running, at that lane's own MEASURED median hold — SCALP 8h, SWING 28h.
   The throttle is the lever that matters: tolerance takes 42 cards a day
   to 31, the throttle takes it to 6.3.

   NEITHER IS AN EDGE PLAY and these tests say so. Sweeping cool-downs 4h
   to 48h, every gross CI spans zero; the apparent gain at 24-48h is an
   artifact of taking the FIRST eligible signal and vanishes under
   randomisation. What they buy is a rate a person can act on, and rows
   that overlap less so the intervals mean something.

   Run: node tests/test-omnigold-publication-rate.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundRows } from '../lib/unprovable-fill.mjs';


const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const doc = { getElementById: () => null, createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }),
              querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
              body: { appendChild(){} }, addEventListener(){} };
const ctx = { console, Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array,
              JSON, Date, RegExp, document: doc, setTimeout: () => 0, clearTimeout: () => {},
              addEventListener: () => {}, fetch: () => Promise.reject(new Error('no net')),
              localStorage: { getItem: () => null, setItem(){}, removeItem(){} } };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'hg-plan.js', 'hg-gates.js', 'omnigold.js']){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* optional deps degrade */ }
}

const H = 3600000;
const card = (dir, horizon, entry, stop, kind) =>
  ({ dir, horizon, kind: kind || 'MMOVE', plan: { entry, stop, t1: entry + (entry - stop) * 2 } });

console.log('== the trade key tolerates cents ==');
{
  const key = ctx.ogTradeKey;
  ok(typeof key === 'function', 'ogTradeKey is exported');
  /* the grid is proportional, ~0.10% — about $4.70 on $4,700 gold */
  ok(key(card('long', 'SCALP', 4700, 4650)) === key(card('long', 'SCALP', 4701, 4650)),
     '$1 apart is ONE trade — it used to be two cards');
  ok(key(card('long', 'SCALP', 4700, 4650)) !== key(card('long', 'SCALP', 4760, 4650)),
     'but $60 apart — more than two stop floors — stays two trades');

  /* THE GRID'S REAL LIMIT, asserted rather than wished away. A bucket edge
     splits pairs that are far closer than the tolerance: these two are
     0.004 ticks apart and still key differently. It is a MISSED merge — an
     extra card, never a wrong one — and it is why this file does not claim
     "any two cents collapse". Measured miss rate is d/t, ~0.4% of such
     pairs at two cents on a $4.70 tick. */
  ok(key(card('long', 'SCALP', 4713.89, 4690)) !== key(card('long', 'SCALP', 4713.91, 4690)),
     'two cents across a bucket edge do NOT collapse — the documented limit, asserted');
  ok(key(card('long', 'SCALP', 4714.5, 4690)) === key(card('long', 'SCALP', 4714.6, 4690)),
     'while ten cents well inside one bucket do');

  ok(key(card('long', 'SCALP', 4700, 4650)) !== key(card('short', 'SCALP', 4700, 4650)),
     'direction still separates');
  ok(key(card('long', 'SCALP', 4700, 4650)) !== key(card('long', 'SWING', 4700, 4650)),
     'and horizon still separates — same levels, different target and time stop');
  ok(key(card('long', 'SCALP', 4700, 4650)) === key(card('long', 'SCALP', 4700, 4650)),
     'the key is stable for identical input');

  /* keying on each plan's own risk would make the relation asymmetric */
  const tight = card('long', 'SCALP', 4700, 4699);
  const wide = card('long', 'SCALP', 4700, 4600);
  ok(ctx.ogTradeKey(tight) !== ctx.ogTradeKey(wide), 'a tight and a wide stop are still two trades');

  ok(typeof key({}) === 'string', 'a card with no plan still yields a key rather than throwing');
  ok(/na/.test(key({ dir: 'long', horizon: 'SCALP' })), 'and an absent level reads as absent, not as 0');
}

console.log('\n== the lane cool-down is the lane\'s own measured hold ==');
{
  const ms = ctx.hgOgLaneCooldownMs;
  ok(ms('SCALP') === 8 * H, 'SCALP is 8h — its median fire-to-exit on the walk');
  ok(ms('SWING') === 28 * H, 'SWING is 28h — its own');
  ok(ms('scalp') === 8 * H, 'the lookup is case-insensitive');
  ok(ms('NONSENSE') === 8 * H, 'an unknown horizon falls back rather than throwing');
  ok(ms(undefined) === 8 * H, 'and so does a missing one');
  ok(ms('SWING') > ms('SCALP'), 'a swing occupies its lane longer than a scalp, as measured');
}

console.log('\n== a card does not publish into an occupied lane ==');
{
  const T = ctx.hgOgLaneThrottle;
  const t0 = 1_700_000_000_000;
  const list = [card('long', 'SCALP', 4700, 4650), card('long', 'SCALP', 4800, 4750)];

  const first = T(list, {}, t0);
  ok(first.shown.length === 1, 'two SCALP longs on one scan publish ONE');
  ok(first.shown[0].plan.entry === 4700, 'the first in rank order takes the lane');
  ok(list[1].laneThrottled === true, 'and the other is marked throttled, not silently vanished');

  /* the other three lanes are untouched */
  const mixed = T([card('long', 'SCALP', 4700, 4650), card('short', 'SCALP', 4700, 4750),
                   card('long', 'SWING', 4700, 4650), card('short', 'SWING', 4700, 4750)], {}, t0);
  ok(mixed.shown.length === 4, 'four different lanes all publish — the throttle is per lane');
}

console.log('\n== the lane reopens on its own schedule ==');
{
  const T = ctx.hgOgLaneThrottle;
  const t0 = 1_700_000_000_000;
  const lane = { 'long|SCALP': t0, 'long|SWING': t0 };

  ok(T([card('long', 'SCALP', 4700, 4650)], lane, t0 + 7 * H).shown.length === 0,
     'a SCALP long at +7h is still suppressed');
  ok(T([card('long', 'SCALP', 4700, 4650)], lane, t0 + 9 * H).shown.length === 1,
     'at +9h the lane is free again');
  ok(T([card('long', 'SWING', 4700, 4650)], lane, t0 + 9 * H).shown.length === 0,
     'but a SWING long at +9h is not — it holds its lane for 28h');
  ok(T([card('long', 'SWING', 4700, 4650)], lane, t0 + 29 * H).shown.length === 1,
     'and reopens at +29h');
}

console.log('\n== it never eats the book, and never mutates the caller\'s state ==');
{
  const T = ctx.hgOgLaneThrottle;
  const t0 = 1_700_000_000_000;
  const held = { 'long|SCALP': t0 };
  const before = JSON.stringify(held);
  T([card('long', 'SCALP', 4700, 4650), card('short', 'SWING', 4700, 4750)], held, t0 + H);
  ok(JSON.stringify(held) === before, 'the map passed in is not written to — two renders cannot disagree');

  ok(T([], {}, t0).shown.length === 0, 'an empty list yields an empty list');
  ok(T(null, {}, t0).shown.length === 0, 'and a null list does not throw');
  ok(T([null, card('long', 'SCALP', 4700, 4650)], {}, t0).shown.length === 1,
     'a null entry is skipped, not published');

  /* no timestamp = no throttling: better to show everything than to hide
     the book because a clock was missing */
  const noClock = T([card('long', 'SCALP', 4700, 4650), card('long', 'SCALP', 4800, 4750)],
                    { 'long|SCALP': t0 }, NaN);
  ok(noClock.shown.length === 2, 'with no usable timestamp nothing is suppressed — fail open');
}

console.log('\n== what it does to the real walk ==');
{
  /* the claim in the source comment, checked against the artifact it came
     from rather than taken on trust */
  const walk = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'backtest-omnigold-results.json'), 'utf8'));
  /* EVERY settled row, unprovable fills included. The question here is how
     many plans the desk put on screen, and a card was published whether or
     not the bar data can later show the order filled — that ambiguity
     belongs to the evidence tables, not to the publication rate. */
  const rows = walk.trades.filter(r => typeof r.rMultiple === 'number')
    .sort((a, b) => new Date(a.tISO) - new Date(b.tISO));
  const days = (new Date(walk.meta.span.to) - new Date(walk.meta.span.from)) / 864e5;

  const before = rows.length / days;
  ok(before > 40, 'the walk really did publish ' + before.toFixed(1) + ' plans a day');

  const last = {}, kept = [];
  for (const r of rows){
    const lane = r.dir + '|' + r.horizon, t = +new Date(r.tISO);
    const cd = ctx.hgOgLaneCooldownMs(r.horizon);
    if (last[lane] && t - last[lane] < cd) continue;
    kept.push(r); last[lane] = t;
  }
  const after = kept.length / days;
  ok(after < 10, 'the lane cool-down takes it to ' + after.toFixed(1) + ' a day');
  ok(after > 3, 'without collapsing to nothing — ' + kept.length + ' cards remain');

  /* And the honest part: it is not an edge.

     Judged at the CAUTIOUS bound, deliberately. Every row the walk scored
     is in the rate above, because every one of them was a card on screen —
     but 21.5% of them are pending orders that resolved on their own fill
     bar, and scoring those pro-strategy is what makes a throttled book look
     significant. Run on all rows this same statistic reads t=4.00, which is
     the flattery lib/unprovable-fill.mjs exists to stop, not a finding. */
  const s = a => a.reduce((x, y) => x + y, 0);
  const cautious = boundRows(kept, 'lower');
  const xs = cautious.map(r => r.rMultiple), mu = s(xs) / xs.length;
  const sd = Math.sqrt(s(xs.map(x => (x - mu) * (x - mu))) / (xs.length - 1));
  const t = mu / (sd / Math.sqrt(xs.length));
  ok(Math.abs(t) < 1.96,
     'and the thinned book is STILL not distinguishable from zero — t=' + t.toFixed(2)
     + ' on ' + cautious.length + ' rows. This rule buys tradeability, not edge.');

  /* the claim above is a bound, so say which one and what the other is */
  const optimistic = boundRows(kept, 'upper');
  const xo = optimistic.map(r => r.rMultiple), mo = s(xo) / xo.length;
  ok(mo > mu, 'the optimistic bound is higher (' + mo.toFixed(3) + 'R vs ' + mu.toFixed(3)
     + 'R) — the thinned book is an interval too, and only its worst end is asserted here');
}

console.log('\n' + passed + ' passed, 0 failed');
