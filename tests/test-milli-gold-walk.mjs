/**
 * hg-v937 — MILLI GOLD backtested, and forward-tested honestly.
 *
 * hg-v936 shipped a roster chosen on the WHOLE walk, disclosed that, and then
 * led the tab with that roster's in-sample figure anyway, calling it an upper
 * bound. This pack measured the bound. It is NEGATIVE.
 *
 * Rebuilt on the earlier part of the walk and judged on what came after, at
 * three anchored splits and both fill bounds, the rule beats the full OMNIGOLD
 * book in 6 of 6 trials — unanimously — and is net-positive in 0 of 6. So
 * selecting the mechanics that have paid is measurably better than not
 * selecting, and still loses on every slice that came after the choice.
 *
 * What this guard pins:
 *   1. the forward test never lets the roster see the slice it is scored on,
 *      proved behaviourally with a mechanic that only wins in the tail;
 *   2. the SHIPPED roster's score on those same tails is marked contaminated
 *      and is never the number the verdict rests on;
 *   3. "beats the desk" and "pays" are tracked SEPARATELY, because the whole
 *      finding is that one happened and the other did not;
 *   4. the sequential book takes one position at a time and skips rather than
 *      queues, so it is a book one account could have run;
 *   5. the tab leads with the forward result, and with none baked it refuses
 *      to quote the in-sample figure on its own.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as W from '../scripts/milli-gold-walk.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const SRC = readFileSync(join(ROOT, 'milligold.js'), 'utf8');
const R = W.run();

/* ---- 1. the forward test cannot see its own test slice ---- */
console.log('1. the roster is built on the past, and only on the past');
{
  /* WINS-LATE pays only in the final third. A rule that leaked the test slice
     would admit it when trained on the first half; one that does not, cannot. */
  const rows = [];
  for (let i = 0; i < 300; i++){
    const late = i >= 200;
    /* The late payoff must be big enough that WINS-LATE is net-POSITIVE over
       the whole series, or the mirror below cannot hold and the first
       assertion passes for the wrong reason: a mechanic that loses overall is
       rejected by the rule whether or not the test slice leaked. */
    rows.push({ kind: 'WINS-LATE', g: late ? 3 : -1, net: late ? 3 : -1,
                tISO: new Date(Date.UTC(2026, 3, 1) + i * 36e5).toISOString() });
    rows.push({ kind: 'STEADY', g: 0.02, net: 0.02,
                tISO: new Date(Date.UTC(2026, 3, 1) + i * 36e5).toISOString() });
  }
  const train = rows.slice(0, Math.floor(rows.length * 0.5));
  const learned = W.rosterFrom(train);
  ok(!learned.has('WINS-LATE'),
     'a mechanic that only pays in the tail is NOT selected from the head — no leak');
  ok(learned.has('STEADY'), 'and one that pays throughout is selected');
  ok(W.rosterFrom(rows).has('WINS-LATE'),
     'trained on everything it WOULD be selected — which is the leak being prevented');

  /* The sample floor is the rule's, not a looser one for this walk. */
  const thin = [{ kind: 'THIN', g: 5, net: 5, tISO: '2026-04-01T00:00:00.000Z' }];
  ok(!W.rosterFrom(thin).has('THIN'),
     'a mechanic under the sample floor is never admitted however well it did');
  eq(W.MIN_N === undefined, true, 'the floor is imported from the roster generator, not redefined here');
}

/* ---- 2. the shipped roster is judged, and marked contaminated ---- */
console.log('2. what ships is measured, and its in-sample score is labelled');
{
  const ship = W.shippedRoster(SRC);
  ok(ship.size > 0, 'the shipped roster is read out of milligold.js, not retyped');
  eq(ship.size, R.shipped.length, 'and the walk judges exactly that set');
  for (const k of R.shipped) ok(SRC.indexOf("kind: '" + k + "'") > 0, k + ' is in the shipped literal');
  let threw = false;
  try { W.shippedRoster('var x = 1;'); } catch (e){ threw = true; }
  ok(threw, 'a source with no roster is fatal, not an empty set silently judged');

  for (const end of W.ENDS) for (const f of R.forward[end]){
    ok(f.shippedOnTest.n > 0, 'the shipped roster is scored on each test tail');
    ok(f.onTest.n > 0, 'and so is the honestly re-learned one');
  }
  ok(/contaminated/.test(readFileSync(join(ROOT, 'scripts', 'milli-gold-walk.mjs'), 'utf8')),
     'and the shipped score is marked contaminated where it is printed');
  /* The verdict must not rest on the contaminated number. */
  const body = readFileSync(join(ROOT, 'scripts', 'milli-gold-walk.mjs'), 'utf8');
  const verdict = body.slice(body.indexOf('out.beatsDeskAll'), body.indexOf('return out;'));
  ok(!/shippedOnTest/.test(verdict),
     'the verdict is computed from the re-learned roster only');
}

/* ---- 3. beating the desk and paying are DIFFERENT claims ---- */
console.log('3. the finding is that one happened and the other did not');
{
  /* The verdict rule on MIXED trials, which the real six cannot exercise:
     they all beat the desk, so `every` and `some` agree and a mutation
     swapping one for the other survives unseen. */
  const T = (net, desk, n) => ({ onTest: { n: n == null ? 10 : n, net }, deskTest: { net: desk } });
  eq(W.verdict([T(-0.1, -0.2), T(-0.3, -0.2)]).beatsDeskAll, false,
     'ONE split failing sinks the verdict — a majority is not unanimity');
  eq(W.verdict([T(-0.1, -0.2), T(-0.3, -0.2)]).beatsDeskCount, 1, 'and the count still reports 1');
  eq(W.verdict([T(-0.1, -0.2), T(-0.15, -0.2)]).beatsDeskAll, true, 'all agreeing carries it');
  eq(W.verdict([T(0.1, -0.2), T(-0.1, -0.2)]).paysAll, false,
     'and paying in one slice is not paying');
  eq(W.verdict([T(0.1, -0.2), T(0.2, -0.2)]).paysAll, true, 'paying in all is');
  eq(W.verdict([]).beatsDeskAll, false, 'no trials is not a pass');
  eq(W.verdict([T(-0.1, -0.2, 0)]).beatsDeskAll, false, 'and an empty slice cannot agree');

  eq(R.trials, W.ENDS.length * W.SPLITS.length, 'every split at every fill bound is a trial');
  ok(R.beatsDeskCount > 0, 'the roster beats the desk somewhere — ' + R.beatsDeskCount + '/' + R.trials);
  eq(R.beatsDeskAll, true, 'and at EVERY split and bound — unanimous');
  eq(R.paysCount, 0, 'and is net-positive in none of them');
  eq(R.paysAll, false, 'so it does not pay');
  for (const end of W.ENDS) for (const f of R.forward[end]){
    ok(f.onTest.net > f.deskTest.net,
       end + ' @' + f.split + ': roster ' + f.onTest.net + ' beats desk ' + f.deskTest.net);
    ok(f.onTest.net < 0,
       end + ' @' + f.split + ': and is still negative at ' + f.onTest.net);
  }
  /* The in-sample book is positive, which is exactly why the forward test had
     to be run rather than the in-sample figure quoted. */
  ok(R.ends['as-recorded'].all.milli.net > 0 && R.ends.lower.all.milli.net > 0,
     'the roster reads POSITIVE on the walk it was chosen from, at both bounds');
  ok(R.ends['as-recorded'].all.milli.net > Math.max(
       ...W.ENDS.flatMap((e) => R.forward[e].map((f) => f.onTest.net))),
     'and better than every forward slice — the gap IS the selection bias');
  const shared = W.ENDS.flatMap((e) => R.forward[e].map((f) => f.overlap));
  ok(Math.min(...shared) < R.shipped.length,
     'not every shipped mechanic is re-chosen without the whole walk — '
     + Math.min(...shared) + '-' + Math.max(...shared) + ' of ' + R.shipped.length);
}

/* ---- 4. the sequential book is one account's book ---- */
console.log('4. one position at a time, skipped not queued');
{
  const t = (h) => new Date(Date.UTC(2026, 3, 1) + h * 36e5).toISOString();
  const rows = [
    { kind: 'A', g: 1, net: 1, tISO: t(0), exitISO: t(10) },
    { kind: 'B', g: 1, net: 1, tISO: t(2), exitISO: t(4) },   /* inside A — skipped */
    { kind: 'C', g: 1, net: 1, tISO: t(11), exitISO: t(12) }
  ];
  const seq = W.sequential(rows);
  eq(seq.length, 2, 'a plan arriving while one is open is skipped');
  eq(seq.map((x) => x.kind).join(','), 'A,C', 'and the one after the exit is taken');
  ok(W.sequential([]).length === 0, 'an empty book takes nothing');
  /* Order is by time, not by the array's order. */
  const shuffled = [rows[2], rows[0], rows[1]];
  eq(W.sequential(shuffled).map((x) => x.kind).join(','), 'A,C',
     'and the walk sorts by time rather than trusting the array');
  for (const end of W.ENDS){
    const e = R.ends[end];
    ok(e.oneAtATime.milli.n < e.all.milli.n,
       end + ': the sequential book is smaller than the all-at-once one');
    ok(e.oneAtATime.desk.n < e.all.desk.n, end + ': and so is the desk\'s');
  }
}

/* ---- 5. the tab leads with the forward result ---- */
console.log('5. the tab quotes the measurement that decides, not the one that flatters');
{
  const lit = SRC.match(/var HG_MILLI_FORWARD = \{[\s\S]*?\n  \};/);
  ok(!!lit, 'milligold.js carries the generated forward literal');
  ok(W.splice(SRC, W.renderForward(R)) === SRC, 'the committed tree round-trips to zero drift');
  const once = W.splice(SRC, W.renderForward(R));
  eq(W.splice(once, W.renderForward(R)), once, 'and the splice is idempotent');
  const wrecked = SRC.replace(/var HG_MILLI_FORWARD = \{[\s\S]*?\n  \};/,
    'var HG_MILLI_FORWARD = { trials: 0 };');
  ok(wrecked !== SRC, 'the corruption changes the source');
  eq(W.splice(wrecked, W.renderForward(R)), SRC, 'and it rebuilds BYTE-IDENTICAL');
  let threw = false;
  try { W.splice('var x = 1;', 'var HG_MILLI_FORWARD = {};'); } catch (e){ threw = true; }
  ok(threw, 'missing markers are fatal');
  ok(!/writeFileSync\(/.test(readFileSync(join(ROOT, 'tests', 'test-milli-gold-walk.mjs'), 'utf8')),
     'and THIS TEST never writes milligold.js');

  const panel = SRC.slice(SRC.indexOf('function hgMilliDisclosureHtml'),
                          SRC.indexOf('function hgMilliRosterHtml'));
  ok(/FORWARD-TESTED/.test(panel), 'the panel leads with the forward result');
  ok(/NO FORWARD RESULT/.test(panel),
     'and with none baked it says so rather than falling back to the in-sample figure');
  ok(panel.indexOf('F.pays') > 0 && panel.indexOf('F.beatsDesk') > 0,
     'both halves of the finding are rendered');
  ok(/distrust/.test(panel), 'and the in-sample number is named as the one to distrust');
}

console.log((fail ? 'FAILED ' : 'OK ') + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
