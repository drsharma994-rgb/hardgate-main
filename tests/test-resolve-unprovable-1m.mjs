/* HARDGATE — the only thing that can narrow the interval.

   1,751 of the omnigold walk's settled rows are pending orders that resolved
   on their own fill bar, and hourly OHLC cannot order the entry touch
   against the exit touch. No estimator fixes that; only finer bars do.
   scripts/resolve-unprovable-1m.mjs replays each of those trades minute by
   minute inside its own fill bar.

   The fetch needs egress and this test deliberately does not have any: the
   ordering rule is a pure function over bars, so it is tested against
   fixtures that encode each case by hand. What the network changes is
   whether the script has data, never what it concludes from it.

   The case that matters most is the one where the rule REFUSES: a single
   minute spanning two levels is the same unprovability one resolution
   finer, and guessing there would reintroduce exactly the defect this whole
   mechanism exists to remove.

   Run: node tests/test-resolve-unprovable-1m.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveInsideBar, resolveForward } from '../scripts/resolve-unprovable-1m.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

/* a long: entry 4700, stop 4670, target 4760 — resting BUY_LIMIT below */
const LONG = { dir: 'long', orderType: 'BUY_LIMIT', entry: 4700, stop: 4670, t1: 4760 };
/* a short: entry 4700, stop 4730, target 4640 — resting SELL_LIMIT above */
const SHORT = { dir: 'short', orderType: 'SELL_LIMIT', entry: 4700, stop: 4730, t1: 4640 };
const bar = (h, l) => ({ o: (h + l) / 2, h, l, c: (h + l) / 2 });

console.log('== the entry printed first: the trade existed ==');
{
  /* minute 1 dips to the limit, minute 2 runs to target */
  const v = resolveInsideBar([bar(4705, 4698), bar(4765, 4740)], LONG);
  ok(v.settled === 'win', 'entry then target is a WIN — the walk was right, and now it is shown');
  ok(v.reason === 'target', 'and it says which level ended it');

  const l = resolveInsideBar([bar(4705, 4698), bar(4695, 4665)], LONG);
  ok(l.settled === 'loss', 'entry then stop is a LOSS');

  const s = resolveInsideBar([bar(4702, 4695), bar(4645, 4630)], SHORT);
  ok(s.settled === 'win', 'and the short side resolves the same way');
}

console.log('\n== the exit printed first: that touch was not this trade\'s ==');
{
  /* the hour looked like "touched entry AND touched target". At one minute
     the target prints while the order is still resting — so it was never
     this trade's target. The order may still fill afterwards. */
  const v = resolveInsideBar([bar(4765, 4755), bar(4705, 4698), bar(4710, 4702)], LONG);
  ok(v.settled === 'open',
     'the target printed while the order rested, then the order filled — the position is open, not won');

  /* and if it never comes back, there was no trade at all */
  const n = resolveInsideBar([bar(4765, 4755), bar(4770, 4760)], LONG);
  ok(n.settled === 'never-filled', 'an order the minutes never touch never filled');
  ok(n.reason === 'order-never-touched', 'and says so plainly');
}

console.log('\n== one minute spanning both levels stays unprovable ==');
{
  /* THE refusal. A minute that touches the limit AND the target is the same
     problem the hour had. Sixty times smaller, and still not knowable. */
  const v = resolveInsideBar([bar(4765, 4698)], LONG);
  ok(v.settled === null, 'a minute spanning entry and target resolves to NOTHING');
  ok(v.residual === true, 'and is reported as residual rather than counted either way');

  const s = resolveInsideBar([bar(4702, 4635)], SHORT);
  ok(s.settled === null && s.residual === true, 'same on the short side');

  /* a minute touching entry and STOP is equally unprovable — the asymmetry
     that started all of this must not creep back in on the loss side */
  const l = resolveInsideBar([bar(4705, 4665)], LONG);
  ok(l.settled === null && l.residual === true,
     'a minute spanning entry and STOP is refused too — not quietly scored a loss');
}

console.log('\n== an open position is a state, not a failure ==');
{
  const v = resolveInsideBar([bar(4705, 4698), bar(4710, 4702)], LONG);
  ok(v.settled === 'open', 'filled and still running at the end of the fine series');
  ok(v.reason === 'still-open-at-bar-end', 'named so the caller knows to walk forward');
}

console.log('\n== missing input yields no verdict, never a default one ==');
{
  ok(resolveInsideBar([], LONG).settled === null, 'no bars yields null');
  ok(resolveInsideBar(null, LONG).reason === 'no-data', 'and a null series says no-data');
  ok(resolveInsideBar([bar(4705, 4698)], { dir: 'long' }).reason === 'no-levels',
     'a trade with no levels yields no-levels rather than throwing');
  ok(resolveInsideBar([bar(4705, 4698)], null).settled === null, 'and no trade at all is handled');
}

console.log('\n== walking forward reuses the walk\'s own rule ==');
{
  ok(resolveForward([bar(4710, 4705), bar(4765, 4750)], LONG).settled === 'win', 'target ends it');
  ok(resolveForward([bar(4710, 4705), bar(4690, 4665)], LONG).settled === 'loss', 'stop ends it');

  /* an ALREADY-FILLED position whose bar spans both levels IS a stop — the
     position certainly exists and only the exit is unknown. Same convention
     as hg-forward.js, deliberately, so the two cannot disagree. */
  const both = resolveForward([bar(4765, 4665)], LONG);
  ok(both.settled === 'loss' && both.bothTouch === true,
     'and a both-touch bar on an OPEN position is a stop — that case is not the unprovable one');

  const t = resolveForward([bar(4710, 4705), bar(4712, 4706)], LONG, 2);
  ok(t.settled === 'timeout', 'the horizon ends it when nothing else does');
  ok(resolveForward([], LONG).settled === 'open', 'and running out of bars leaves it open');
}

console.log('\n== the script refuses to guess when it has no data ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'resolve-unprovable-1m.mjs'), 'utf8');
  ok(/No estimate is offered in its place/.test(src),
     'a failed fetch says nothing was resolved rather than falling back to an estimate');
  ok(/if \(!WRITE\)/.test(src), 'and nothing is written without --write');
  ok(/unprovableFill: false/.test(src),
     'a settled row clears the flag, which narrows the interval for every consumer');
  ok(/npm run og:bake/.test(src), 'and it says what to re-run so the tab picks the change up');
}

console.log('\n== it is wired up where a person would look for it ==');
{
  const lib = fs.readFileSync(path.join(ROOT, 'lib', 'unprovable-fill.mjs'), 'utf8');
  ok(/resolve-unprovable-1m/.test(lib), 'the shared rule names the script that can settle its rows');
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  ok(pkg.scripts && pkg.scripts['og:resolve-1m'], 'and there is an npm script for it');
}

console.log('\n' + passed + ' passed, 0 failed');
