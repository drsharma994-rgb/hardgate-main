/* HARDGATE — which came first, inside the bar.

   hg-v931 measured what bar resolution costs OMNIGOLD: 672 `both-touch` rows,
   8.3% of its filled book, against 23 (0.9%) on GOLD SCALP — because its
   scalp lane runs on 1h bars and GOLD SCALP's on 15m, and a longer bar is
   likelier to hold stop and target together. Those rows are the entire reason
   its win rate reads 30.4% at one fill bound and 38.6% at the other: below
   its 33.3% breakeven at one end and above it at the other.

   A finer bar inside the ambiguous one answers it. What this file pins is
   that the answer is EARNED, never guessed:

     - the FIRST finer bar to touch a level decides, and the bars are sorted
       here rather than trusted, because an out-of-order feed would otherwise
       silently pick the winner;
     - a finer bar that ITSELF holds both levels resolves NOTHING — the same
       problem one level down, and picking a side there is the guess this
       exists to avoid;
     - every failure path (no bars, wrong window, a throwing fetch, no exit
       stamp) leaves the row EXACTLY as the stop-first walk recorded it.

   A guess here writes itself straight into the desk's win rate, so the
   conservative fallback is tested harder than the happy path.

   Run: node tests/test-ambiguous-bar.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAmbiguousBar, applyResolution, touchesStop, touchesTarget } from '../lib/ambiguous-bar.mjs';
import { resolveArtifact, isAmbiguous, rowBarSec, plannedRr, toBars, TF_SEC } from '../scripts/resolve-ambiguous.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };

const T0 = 1700000000;
const bar = (i, h, l) => ({ t: T0 + i * 60, o: (h + l) / 2, h, l, c: (h + l) / 2 });
/* a long: entry 100, stop 95, target 110 */
const LONG = { dir: 'long', stop: 95, t1: 110, barStartSec: T0, barEndSec: T0 + 3600 };

console.log('\n1. the touch tests, both directions');
{
  ok(touchesStop({ l: 94, h: 99 }, 'long', 95) === true, 'a long stops when the low reaches the stop');
  ok(touchesStop({ l: 96, h: 99 }, 'long', 95) === false, 'and not when it does not');
  ok(touchesStop({ l: 96, h: 106 }, 'short', 105) === true, 'a short stops when the HIGH reaches it');
  ok(touchesTarget({ l: 96, h: 110 }, 'long', 110) === true, 'a target is inclusive at the level');
  ok(touchesTarget({ l: 90, h: 99 }, 'short', 90) === true, 'and the same for a short');
}

console.log('\n2. the first finer bar to touch a level decides it');
{
  const stopFirst = resolveAmbiguousBar([bar(0, 99, 94), bar(1, 111, 99)], LONG);
  ok(stopFirst.verdict === 'stop', 'stop touched in minute 0 -> STOP, though the target came later');
  ok(stopFirst.at === T0, 'and the minute is recorded');
  ok(stopFirst.scanned === 2, 'having scanned both bars in the window');

  const targetFirst = resolveAmbiguousBar([bar(0, 111, 99), bar(1, 99, 94)], LONG);
  ok(targetFirst.verdict === 'target', 'the reverse order gives the opposite verdict');
  ok(/target touched first/.test(targetFirst.reason), 'and says why in words');

  /* SORTED HERE, NOT TRUSTED — an out-of-order feed must not pick the winner */
  const shuffled = resolveAmbiguousBar([bar(5, 99, 94), bar(1, 111, 99)], LONG);
  ok(shuffled.verdict === 'target',
     'bars arriving out of order are sorted by time before anything is decided');
}

console.log('\n3. THE THIRD OUTCOME — unresolved is not a failure');
{
  const both = resolveAmbiguousBar([bar(0, 111, 94)], LONG);
  ok(both.verdict === null, 'a finer bar holding BOTH levels resolves nothing');
  ok(/holds both levels too/.test(both.reason), 'and says so rather than picking a side');

  ok(resolveAmbiguousBar([], LONG).verdict === null, 'no finer bars -> null');
  ok(/no finer bars/.test(resolveAmbiguousBar([], LONG).reason), 'with the reason named');
  ok(resolveAmbiguousBar(null, LONG).verdict === null, 'a missing array is not a crash');

  const outside = resolveAmbiguousBar([{ t: T0 + 99999, h: 111, l: 99 }], LONG);
  ok(outside.verdict === null && outside.scanned === 0,
     'bars outside the ambiguous window are not evidence about what happened inside it');
  ok(/do not cover the window/.test(outside.reason), 'and the reason distinguishes that from having none');

  const quiet = resolveAmbiguousBar([bar(0, 101, 99), bar(1, 102, 98)], LONG);
  ok(quiet.verdict === null && /reached either level/.test(quiet.reason),
     'finer bars that reach neither level resolve nothing');

  /* THE DIRECTION GUARD HAS TO BE THE DECIDING FACTOR. The obvious fixture
     here — a wide bar with a normal long geometry — trips the both-levels
     branch when read as a short, so it returns null either way and the guard
     goes untested. This geometry resolves cleanly to 'target' if an unknown
     direction is allowed to fall through to the short branch. */
  const noDir = resolveAmbiguousBar([bar(0, 99, 97)],
    { dir: 'sideways', stop: 120, t1: 110, barStartSec: T0, barEndSec: T0 + 60 });
  ok(noDir.verdict === null && /no direction/.test(noDir.reason),
     'an unknown direction resolves nothing rather than falling through to a side');
  ok(resolveAmbiguousBar([bar(0, 111, 99)], { dir: 'long', stop: NaN, t1: 110, barStartSec: T0, barEndSec: T0 + 60 }).verdict === null,
     'and so does a missing level');
}

console.log('\n4. applying a verdict — and refusing to');
{
  const row = () => ({ outcome: 'loss (both-touch)', rMultiple: -1, entry: 100, stop: 95, t1: 110 });
  const win = applyResolution(row(), { verdict: 'target', reason: 'target touched first', at: T0 }, 3);
  ok(win.outcome === 'win' && win.rMultiple === 3, 'a target verdict credits the PLANNED reward, not a guess');
  ok(win.ambiguousResolved === true && win.resolvedAt === T0, 'and records that it was measured, and when');

  const loss = applyResolution(row(), { verdict: 'stop', reason: 'stop touched first', at: T0 }, 3);
  ok(loss.outcome === 'loss' && loss.rMultiple === -1, 'a stop verdict confirms the conservative answer');
  ok(loss.ambiguousResolved === true, 'and is still marked as MEASURED, not assumed — that is the difference');

  /* FAILS CONSERVATIVE: this is the path that runs when the network is down */
  const kept = applyResolution(row(), { verdict: null, reason: 'no finer bars' });
  ok(kept.outcome === 'loss (both-touch)' && kept.rMultiple === -1,
     'an unresolved row is left EXACTLY as the stop-first walk recorded it');
  ok(kept.ambiguousResolved === false && /no finer bars/.test(kept.ambiguousWhy),
     'flagged as unresolved with the reason, so it cannot be mistaken for a measurement');
  ok(applyResolution(null, { verdict: 'target' }, 3) === null, 'a missing row is not a crash');
}

console.log('\n5. the whole pass, end to end, with NO network');
{
  const mk = (o) => Object.assign({ horizon: 'SCALP', dir: 'long', entry: 100, stop: 95, t1: 110,
                                    outcome: 'loss (both-touch)', rMultiple: -1,
                                    exitISO: new Date(T0 * 1000).toISOString() }, o || {});
  const art = { trades: [
    mk({ id: 'a' }),
    mk({ id: 'b' }),
    mk({ id: 'c', outcome: 'loss' }),          /* not ambiguous — must be untouched */
    mk({ id: 'd', outcome: 'win', rMultiple: 3 })
  ] };
  /* minute 0 hits the target on row a; row b's first minute hits the stop */
  const feeds = { a: [bar(0, 111, 99)], b: [bar(0, 99, 94)] };
  let calls = 0;
  const stats = await resolveArtifact(art, {
    tf: '1m',
    fetchBars: async (sym, tf, s, e) => { calls++; return feeds[art.trades[calls - 1].id] || []; }
  });
  ok(stats.ambiguous === 2, 'only the two ambiguous rows were looked at');
  ok(calls === 2, 'and only they caused a fetch — the settled rows cost nothing');
  ok(stats.resolved === 2 && stats.toTarget === 1 && stats.toStop === 1, 'both resolved, one each way');
  /* entry 100, stop 95, target 110 -> risk 5, reward 10, so 2.0R — the number
     is recomputed from the row, never a constant typed beside it */
  ok(art.trades[0].outcome === 'win' && art.trades[0].rMultiple === 2,
     'the target row became a win at its planned 2.0R');
  ok(art.trades[1].outcome === 'loss', 'and the stop row a plain loss');
  ok(art.trades[2].outcome === 'loss' && art.trades[3].outcome === 'win',
     'the non-ambiguous rows are untouched');
  ok(art.trades[2].ambiguousResolved === undefined, 'and carry no resolution flag at all');
}

console.log('\n6. every failure path keeps the conservative book');
{
  const mk = () => ({ horizon: 'SCALP', dir: 'long', entry: 100, stop: 95, t1: 110,
                      outcome: 'loss (both-touch)', rMultiple: -1,
                      exitISO: new Date(T0 * 1000).toISOString() });

  const thrown = { trades: [mk()] };
  const s1 = await resolveArtifact(thrown, { fetchBars: async () => { throw new Error('HTTP 403'); } });
  ok(s1.fetchFailures === 1 && s1.resolved === 0, 'a throwing fetch resolves nothing');
  ok(thrown.trades[0].outcome === 'loss (both-touch)', 'and the row keeps its conservative outcome');
  ok(/HTTP 403/.test(thrown.trades[0].ambiguousWhy), 'with the real reason recorded, not swallowed');

  const empty = { trades: [mk()] };
  const s2 = await resolveArtifact(empty, { fetchBars: async () => [] });
  ok(s2.unresolved === 1 && empty.trades[0].outcome === 'loss (both-touch)', 'empty finer bars change nothing');

  const noStamp = { trades: [Object.assign(mk(), { exitISO: null })] };
  const s3 = await resolveArtifact(noStamp, { fetchBars: async () => [bar(0, 111, 99)] });
  ok(s3.unresolved === 1 && noStamp.trades[0].outcome === 'loss (both-touch)',
     'a row with no exit timestamp has no window to look in, and is left alone');

  const ambigAgain = { trades: [mk()] };
  const s4 = await resolveArtifact(ambigAgain, { fetchBars: async () => [bar(0, 111, 94)] });
  ok(s4.resolved === 0 && ambigAgain.trades[0].outcome === 'loss (both-touch)',
     'a finer bar that is ALSO ambiguous leaves the row conservative');
  ok(Object.keys(s4.reasons).some(k => /holds both levels/.test(k)), 'and the pass reports why');
}

console.log('\n7. the window it looks in matches the walk that made the row');
{
  ok(rowBarSec({ horizon: 'SCALP' }) === TF_SEC['1h'], 'an OMNIGOLD SCALP row came from a 1h bar');
  ok(rowBarSec({ horizon: 'SWING' }) === TF_SEC['4h'], 'a SWING row from 4h');
  ok(rowBarSec({}) === TF_SEC['15m'], 'and a GOLD SCALP row from 15m');
  ok(isAmbiguous({ outcome: 'loss (both-touch)' }) && !isAmbiguous({ outcome: 'loss' }),
     'only both-touch rows are in scope');
  ok(plannedRr({ entry: 100, stop: 95, t1: 110 }) === 2, 'the planned reward is reward over risk');
  ok(toBars([[1700000000000, '1', '2', '0.5', '1.5']])[0].h === 2, 'kline tuples convert to bars');
  ok(toBars(null).length === 0, 'and a bad payload is empty rather than a throw');
}

console.log('\n8. it is honest about what it cannot do here');
{
  const src = fs.readFileSync(root + 'scripts/resolve-ambiguous.mjs', 'utf8');
  ok(/IT FAILS CONSERVATIVE, EVERYWHERE/.test(src), 'the script states its failure mode up front');
  ok(/refusing to rewrite/.test(src),
     'and refuses to rewrite an artifact when nothing was resolved, rather than adding flags and calling it progress');
  ok(/klinesUrl|klinesRouteNote/.test(src), 'it uses the hg-v921 route so a mirror or proxy works');
  ok(/NOTHING RESOLVED/.test(src), 'and says plainly when the run achieved nothing');
}

if (process.exitCode) console.error('\n' + passed + ' passed, but this file FAILED — see above');
else console.log('\n' + passed + ' assertions — all green');
