/* HARDGATE — the 6-hour TTL was unreachable for the records that needed it.

   THE DEFECT. applyHardgateConvictionLock walks store.live and, for each
   record, takes the latest bar of THAT RECORD'S VENUE out of venueRows:

       var vr = venueRows ? venueRows[rec.venue] : null;
       var bar = (rows && rows.length) ? rows[rows.length - 1] : null;
       if (!bar) continue;                    <-- record never evaluated

   and evaluateSetup returned null on a missing candle BEFORE it reached the
   elapsed/TTL branch. So a record whose venue is absent from the current scan
   was never evaluated at all — not stopped, not targeted, and NOT EXPIRED.

   GOLD SCALP's venue label is venueLabel(gold.source), and gold.source moves
   down a feed chain (xm-xauusd -> delta-xaut -> binance-paxg -> proxy). The
   moment it resolves to a different label than the one a record was minted
   under, that record is orphaned and outlives its expiry indefinitely.

   WHY IT MATTERS NOW. Before hg-v930 an orphan was a stale history row. Since
   hg-v930/v931 hgOgOpenGoldConvictions counts every key in live across BOTH
   booking stores, and one open conviction HOLDS EVERY NEW SETUP on GOLD
   SCALP, GOLD SWING and OMNIGOLD. One orphan is a permanent, desk-wide
   lockout whose only visible trace is "1 gold conviction is live" — which is
   exactly what a position someone had just taken looks like.

   THE FIX IS THE TTL AND NOTHING ELSE. The elapsed check is the one
   invalidation that needs no price, so it now runs before the candle guard
   and the pass no longer skips a record it cannot price. Every price-based
   check (STOPPED, TARGET HIT) still requires a bar — repricing a record
   against another venue's candles would be a worse repair, not a stricter
   one. Plus disclosure: each holding record is named with its age.

   Run: node tests/test-conviction-orphan-expiry.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };

globalThis.window = globalThis;
globalThis.self = globalThis;
let STORE = {};
globalThis.localStorage = {
  getItem: k => (k in STORE ? STORE[k] : null),
  setItem: (k, v) => { STORE[k] = String(v); },
  removeItem: k => { delete STORE[k]; } };
vm.runInThisContext(fs.readFileSync(root + 'conviction-lock.js', 'utf8'), { filename: 'conviction-lock.js' });

const APPLY = globalThis.applyHardgateConvictionLock;
const H = 3600 * 1000;
const TTL = 6 * H;
const NOW = Date.UTC(2026, 8, 23, 12, 0, 0);

const rec = (o) => Object.assign({
  id: 'x', dir: 'long', type: 'scalp', entry: 4000, stop: 3990, t1: 4020, t2: 4040,
  venue: 'XM XAUUSD', sym: 'XAUUSD', anchor: 4000, tally: 8, issuedAt: NOW - 2 * H }, o || {});
const bar = (o) => Object.assign({ t: NOW, o: 4000, h: 4005, l: 3995, c: 4001 }, o || {});

/* one pass with a single live record; venueRows keyed by `feedVenue` only */
function pass(record, feedVenue, candle, ranked){
  const store = { v: 1, live: { x: record }, history: [] };
  const vr = {};
  if (feedVenue) vr[feedVenue] = { rows15m: candle ? [candle] : [] };
  return APPLY(store, ranked || [], vr, NOW, {
    type: 'scalp', rowKey: 'rows15m', historyLimit: 8,
    venueScopedKeys: false, expiryMs: TTL });
}
const liveN = g => Object.keys(g.store.live).length;
const status = g => (g.transitions[0] || {}).status || null;

console.log('\n1. the orphan case: venue absent from this scan');
{
  /* the record is 400x its own TTL old. Nothing about it is ambiguous. */
  const g = pass(rec({ issuedAt: NOW - 400 * H }), 'Delta XAUTUSD', bar());
  ok(status(g) === 'EXPIRED', 'a 400h-old record whose venue is not in this scan EXPIRES');
  ok(liveN(g) === 0, '  and leaves store.live, so it stops holding the desk');
  ok(g.store.history.length === 1 && g.store.history[0].status === 'EXPIRED',
     '  and lands in history with its status, like any other closed record');
  ok(g.unpriced === 1, 'the pass reports it as unpriced — no bar existed for its venue');
}

console.log('\n2. the same record, same age, only the venue label matches');
{
  const g = pass(rec({ issuedAt: NOW - 400 * H }), 'XM XAUUSD', bar());
  ok(status(g) === 'EXPIRED', 'expires — this always worked, and is the control');
  ok(g.unpriced === 0, '  and is not counted unpriced');
  /* the defect was exactly this pair disagreeing: same record, same clock,
     different answer, decided by which feed the scan happened to resolve to. */
}

console.log('\n3. the fix must not free a record that is genuinely live');
{
  const fresh = pass(rec({ issuedAt: NOW - 2 * H }), 'Delta XAUTUSD', bar());
  ok(liveN(fresh) === 1 && status(fresh) === null,
     'a 2h-old orphan (TTL 6h) STAYS LIVE — unpriced is not expired');
  ok(fresh.unpriced === 1, '  and is still reported as unpriced');

  const none = pass(rec({ issuedAt: NOW - 2 * H }), null, null);
  ok(liveN(none) === 1, 'no venueRows at all: a fresh record still stands');
  const noneStale = pass(rec({ issuedAt: NOW - 400 * H }), null, null);
  ok(liveN(noneStale) === 0 && status(noneStale) === 'EXPIRED',
     'no venueRows at all: a stale record still expires — the feed being down '
     + 'is the case the TTL exists for');
}

console.log('\n4. price-based invalidation still REQUIRES a bar');
{
  /* a 15m close beyond the stop is STOPPED — but only where there is a close.
     If the fix had made price checks fire without a bar this would throw or
     mis-fire; the point is that only the clock works blind. */
  const stopped = pass(rec(), 'XM XAUUSD', bar({ l: 3980, c: 3985 }));
  ok(status(stopped) === 'STOPPED', 'closed beyond stop on ITS venue: STOPPED');

  const orphanBeyond = pass(rec(), 'Delta XAUTUSD', bar({ l: 3980, c: 3985 }));
  ok(status(orphanBeyond) === null && liveN(orphanBeyond) === 1,
     'the same bar under ANOTHER venue does not stop it — a record is never '
     + 'priced against a venue it was not minted on');

  const hit = pass(rec(), 'XM XAUUSD', bar({ h: 4025, c: 4022 }));
  ok(status(hit) === 'TARGET HIT', 'T1 touched on its venue: TARGET HIT');
}

console.log('\n5. the TTL check is genuinely ahead of the candle guard');
{
  const src = fs.readFileSync(root + 'conviction-lock.js', 'utf8');
  const fn = src.slice(src.indexOf('ConvictionLockManager.prototype.evaluateSetup'));
  const body = fn.slice(0, fn.indexOf('\n};'));
  const ttlAt = body.indexOf("return 'EXPIRED'");
  const candleAt = body.indexOf('__normCandle(currentCandle)');
  ok(ttlAt > 0 && candleAt > 0, 'both the TTL branch and the candle guard are present');
  ok(ttlAt < candleAt, 'the TTL branch is reached BEFORE the candle is normalised');
  ok(!/if \(!bar\) continue;/.test(src),
     'the pass no longer skips a record it cannot price');
  /* behavioural, not textual: a manager asked to evaluate a stale setup with
     NO candle at all must say EXPIRED. A source check alone would pass on a
     reorder that some later guard undid. */
  const mgr = new globalThis.ConvictionLockManager({ type: 'scalp', scalpExpiryMs: TTL });
  const setup = { id: 'x', type: 'scalp', direction: 'long', timestamp: NOW - 400 * H,
                  levels: { entry: 4000, stopLoss: 3990, tp1: 4020 } };
  ok(mgr.evaluateSetup(setup, null, true, false, NOW) === 'EXPIRED',
     'evaluateSetup(stale, null candle) === EXPIRED');
  const young = { id: 'y', type: 'scalp', direction: 'long', timestamp: NOW - 1 * H,
                  levels: { entry: 4000, stopLoss: 3990, tp1: 4020 } };
  ok(mgr.evaluateSetup(young, null, true, false, NOW) === null,
     'evaluateSetup(fresh, null candle) === null — still nothing to say without a price');
}

console.log('\n6. a live record is still restored verbatim onto its candidate');
{
  /* the lock exists to stop levels being re-picked under a running trade.
     Nothing above may have loosened that. */
  const cand = { id: 'x', dir: 'long', venue: 'XM XAUUSD', sym: 'XAUUSD',
                 entry: 1, stop: 2, t1: 3, atr: 5, anchor: 4000 };
  const g = pass(rec({ issuedAt: NOW - 2 * H }), 'Delta XAUTUSD', bar(), [cand]);
  ok(cand.locked === true, 'the candidate matching a live record is locked');
  ok(cand.entry === 4000 && cand.stop === 3990 && cand.t1 === 4020,
     '  and its levels are the issued ones, not this scan\'s');
  ok(liveN(g) === 1, '  and the record is still live');
}

console.log('\n7. the reader names what is holding, with an age');
{
  STORE = {};
  globalThis.document = { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
                          querySelector: () => null, querySelectorAll: () => [],
                          head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  globalThis.localStorage.setItem('hgGoldscalpConviction', JSON.stringify({
    v: 1, history: [], live: { x: rec({ issuedAt: NOW - 4 * H - 12 * 60000 }) } }));
  globalThis.localStorage.setItem('hgGoldswingConviction', JSON.stringify({
    v: 1, history: [], live: { y: rec({ id: 'y', dir: 'short', venue: 'Delta XAUTUSD',
                                        issuedAt: NOW - 30 * 60000 }) } }));
  vm.runInThisContext(fs.readFileSync(root + 'omnigold.js', 'utf8'), { filename: 'omnigold.js' });
  const open = globalThis.hgOgOpenGoldConvictions(NOW);
  ok(open.n === 2, 'both booking stores are still counted');
  ok(open.keys.length === 2, '  and keys is unchanged for existing callers');
  ok(Array.isArray(open.rows) && open.rows.length === 2, 'rows describes each holding record');
  const scalp = open.rows.find(r => r.key === 'x');
  const swing = open.rows.find(r => r.key === 'y');
  ok(scalp && scalp.desk === 'SCALP' && swing && swing.desk === 'SWING',
     '  each row names which desk booked it');
  ok(scalp && Math.round(scalp.ageMs / 60000) === 252, '  and its age in ms (4h12m)');
  ok(swing && swing.dir === 'short' && swing.venue === 'Delta XAUTUSD',
     '  with the direction and venue it was minted on');

  const html = globalThis.hgOgHoldingRowsHtml(open);
  const text = String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  ok(/SCALP/.test(text) && /SWING/.test(text), 'the panel lines name both desks');
  ok(/4h 12m/.test(text), '  and print the age that would make an unexpirable record obvious');
  ok(/XM XAUUSD/.test(text) && /Delta XAUTUSD/.test(text), '  and the venue of each');

  /* an older store with no issuedAt must not invent one */
  const bare = { v: 1, history: [], live: { z: { id: 'z', dir: 'long', sym: 'XAUUSD' } } };
  globalThis.localStorage.setItem('hgGoldscalpConviction', JSON.stringify(bare));
  globalThis.localStorage.removeItem('hgGoldswingConviction');
  const o2 = globalThis.hgOgOpenGoldConvictions(NOW);
  ok(o2.n === 1 && o2.rows[0].ageMs === null, 'a record with no issuedAt reports a null age');
  ok(/age not recorded/.test(String(globalThis.hgOgHoldingRowsHtml(o2))),
     '  and the line says so rather than showing 0m or a made-up age');

  /* nothing held renders nothing */
  globalThis.localStorage.removeItem('hgGoldscalpConviction');
  ok(globalThis.hgOgHoldingRowsHtml(globalThis.hgOgOpenGoldConvictions(NOW)) === '',
     'an empty book renders no holding block at all');
}

console.log('\n8. GOLD SCALP shows the same lines, from the same definition');
{
  vm.runInThisContext(fs.readFileSync(root + 'goldscalp.js', 'utf8'), { filename: 'goldscalp.js' });
  const gs = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  ok(/gsHoldingRowsHtml\(res\)/.test(gs), 'the one-at-a-time panel renders the holding lines');
  ok(/W\.hgOgHoldingRowsHtml/.test(gs),
     '  by DELEGATING to omnigold — a second copy would drift like every other');

  /* END TO END, not a hand-built res: a real store, the real omnigold reader,
     gsOpenGoldConvictions -> gsApplyOneAtATime -> the panel. A hand-built res
     cannot tell whether the rows actually survive that chain, and three
     mutations that cut them out of it passed against one. */
  STORE = {};
  globalThis.localStorage.setItem('hgGoldscalpConviction', JSON.stringify({
    v: 1, history: [], live: { x: rec({ issuedAt: Date.now() - 9 * H }) } }));
  globalThis.gsSetOneAtATime(true);
  globalThis.gsOneAtATimeInit();
  const open = globalThis.gsOpenGoldConvictions();
  ok(open.n === 1, 'the delegating reader sees the live record');
  ok(Array.isArray(open.rows) && open.rows.length === 1 && open.rows[0].venue === 'XM XAUUSD',
     '  and carries its rows through, not just the count');

  const held = globalThis.gsApplyOneAtATime(
    [{ id: 'n1', strategy: 'S', dir: 'long', entry: 100, stop: 99, t1: 102 }], open);
  ok(held && held.held === 1, 'a new setup is held while that record is live');
  ok(held.rows && held.rows.length === 1, '  and the hold result carries the rows with it');

  const t = String(globalThis.gsOneAtATimeHtml(held))
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  ok(/held 9h 0m/.test(t),
     'a 9h-old hold on a 6h TTL is legible on the panel that is doing the holding');
  ok(/XAUUSD/.test(t) && /LONG/.test(t) && /XM XAUUSD/.test(t),
     '  alongside what the position is and where it was minted');

  /* the shared renderer is a borrowed function: absent OR throwing, it costs
     the holding lines and never the panel. */
  const saved = globalThis.hgOgHoldingRowsHtml;
  delete globalThis.hgOgHoldingRowsHtml;
  let out = null, threw = false;
  try { out = globalThis.gsOneAtATimeHtml(held); } catch (e) { threw = true; }
  ok(!threw && typeof out === 'string' && out.length > 0 && !/held 9h/.test(out),
     'an ABSENT renderer costs the holding lines, never the panel');
  globalThis.hgOgHoldingRowsHtml = () => { throw new Error('boom'); };
  out = null; threw = false;
  try { out = globalThis.gsOneAtATimeHtml(held); } catch (e) { threw = true; }
  ok(!threw && typeof out === 'string' && out.length > 0,
     'a THROWING renderer costs the holding lines, never the panel');
  globalThis.hgOgHoldingRowsHtml = saved;
}

console.log('\n' + passed + ' assertions passed');
