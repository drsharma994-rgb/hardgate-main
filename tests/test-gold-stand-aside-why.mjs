/**
 * hg-v940 — the combined gold banner names what it passed over.
 *
 * GOLD SCALP was reported as "not populating". Driven end to end it was
 * carrying TWO cards with full levels, and the banner above them said
 * "no tape-aligned engine plan on SCALP — stand aside". Both setups had been
 * DEMOTED by the hg-v930 one-at-a-time hold (two gold convictions already
 * live) and died at the third of SEVEN silent `continue`s in
 * hgGoldUniformCompose. A desk that composed two setups and withheld them
 * read exactly like a desk that found none.
 *
 * This guard pins the disclosure, not the policy:
 *   1. every rejection rule is counted, and a candidate is counted ONCE —
 *      at the first rule that rejected it, so the buckets partition the input;
 *   2. the message names the LARGEST bucket and the total considered;
 *   3. the tape is named only when the tape is what actually did the work;
 *   4. nothing about which candidates qualify changes — the same inputs still
 *      produce the same setup, held list and confirmed flag.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));

const SRC = readFileSync(join(ROOT, 'gold-catalog.js'), 'utf8');
function load(){
  const ctx = { Math, Date, JSON, isFinite, parseFloat, parseInt, Array, Object, String, Number,
    console: { log(){}, warn(){}, error(){} } };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { timeout: 20000 });
  return ctx;
}
const W = load();
const Z = () => ({ dropped: 0, excluded: 0, demoted: 0, noDir: 0, noLevels: 0, sides: 0, grade: 0, againstTape: 0 });
const why = (o, n, tape, hz) => W.hgGoldUniformWhyAside(Object.assign(Z(), o), n, tape, hz || 'SCALP');

/* ---- 1. the message names the binding rule and the count ---- */
console.log('1. the banner says what it passed over');
{
  ok(typeof W.hgGoldUniformWhyAside === 'function', 'gold-catalog.js exports the reason builder');

  const real = why({ demoted: 2 }, 2);
  ok(/2 engine candidates/.test(real), 'it reports how many candidates there were');
  ok(/demoted/.test(real), 'and names the rule that rejected them');
  ok(/held back, cannot lead/.test(real),
     'in words a reader can act on — a demote is the desk withholding, not an absence');
  ok(/all /.test(real), 'saying ALL when every candidate died on one rule');
  ok(!/no tape-aligned engine plan/.test(real),
     'and no longer claims there was no plan when there were two');

  eq(why({}, 0), 'no engine candidates on SCALP — stand aside',
     'an genuinely empty compose still says so plainly');
  ok(/none usable/.test(why({}, 2)),
     'and candidates that survive every rule without a winner are not mislabelled');

  const partial = why({ demoted: 2, grade: 1 }, 3);
  ok(/3 engine candidates/.test(partial), 'the total is the input, not the bucket');
  ok(/2 demoted/.test(partial), 'the bucket size is named when it is not all of them');
  ok(!/all /.test(partial), 'and ALL is not claimed when it is not all');
}

/* ---- 2. the tape is named only when the tape did the work ---- */
console.log('2. the tape is named only when it is the reason');
{
  const t = why({ againstTape: 3 }, 3, 'short');
  ok(/against the tape/.test(t), 'an against-tape stand-aside says so');
  ok(/tape SHORT/.test(t), 'and names the side, which is the actionable part');
  const d = why({ demoted: 2 }, 2, 'short');
  ok(!/tape SHORT/.test(d),
     'but a DEMOTE stand-aside does not blame the tape — that was the old messages error');
  const noTape = why({ againstTape: 1 }, 1, '');
  ok(/against the tape/.test(noTape) && !/tape \)/.test(noTape),
     'and with no tape read it does not print an empty side');
}

/* ---- 3. a candidate is counted once, at the first rule ---- */
console.log('3. the buckets partition the input');
{
  const body = SRC.slice(SRC.indexOf('var skip = {'), SRC.indexOf('out.standAside = skip'));
  for (const k of ['dropped', 'excluded', 'demoted', 'noDir', 'noLevels', 'sides', 'grade'])
    ok(new RegExp('skip\\.' + k + '\\+\\+; continue;').test(body),
       'the ' + k + ' rule increments and then continues — counted once, at the first rule');
  ok(/skip\.againstTape\+\+;/.test(SRC), 'and the against-tape branch is counted too');

  /* behavioural: compose a board where every candidate is demoted and check
     the counts land in one bucket and the total is right. */
  const mk = (over) => Object.assign({ dir: 'short', entry: 100, stop: 105, t1: 90,
                                       grade: 'B', tally: 3 }, over || {});
  const r = W.hgGoldUniformCompose([mk({ demoted: true }), mk({ demoted: true })],
                                   { horizon: 'SCALP' });
  ok(!!r.standAside, 'a stand-aside result carries the tally');
  eq(r.standAside.considered, 2, 'considered is the input length');
  eq(r.standAside.demoted, 2, 'both demoted candidates land in the demoted bucket');
  eq(r.standAside.grade, 0, 'and none is double-counted in a later bucket');
  ok(/2 engine candidates/.test(r.why) && /demoted/.test(r.why),
     'and the why says so — ' + r.why);
  ok(!r.setup, 'with no setup, which is the state being explained');

  /* A MIXED board, because an all-one-bucket fixture cannot tell `considered`
     apart from that bucket: with two demoted candidates both read 2, and a
     mutation reporting the bucket as the total survived unseen. */
  const mixed = W.hgGoldUniformCompose(
    [mk({ demoted: true }), mk({ dropped: true }), mk({ grade: 'C' })],
    { horizon: 'SCALP' });
  eq(mixed.standAside.considered, 3, 'considered counts every candidate handed in');
  eq(mixed.standAside.demoted, 1, 'the demoted bucket holds only the demoted one');
  eq(mixed.standAside.dropped, 1, 'the dropped bucket only the dropped one');
  eq(mixed.standAside.grade, 1, 'the grade bucket only the low-grade one');
  const sum = ['dropped', 'excluded', 'demoted', 'noDir', 'noLevels', 'sides', 'grade',
               'againstTape'].reduce((a, k) => a + mixed.standAside[k], 0);
  eq(sum, mixed.standAside.considered,
     'and the buckets SUM to the input — every candidate counted exactly once');
  ok(/3 engine candidates/.test(mixed.why), 'the why reports the total, not a bucket');
  ok(!/all /.test(mixed.why), 'and does not claim ALL when the board is mixed');

  const dropped = W.hgGoldUniformCompose([mk({ dropped: true })], { horizon: 'SWING' });
  eq(dropped.standAside.dropped, 1, 'a dropped candidate lands in its own bucket');
  ok(/SWING/.test(dropped.why), 'and the horizon is the one asked for');
}

/* ---- 4. nothing about qualification changed ---- */
console.log('4. disclosure only — the same inputs still qualify');
{
  const good = { dir: 'short', entry: 100, stop: 105, t1: 90, grade: 'A', tally: 5 };
  const r = W.hgGoldUniformCompose([good], { horizon: 'SCALP', tape: 'short' });
  ok(!!r.setup, 'a clean tape-aligned grade-A candidate still becomes the setup');
  ok(!r.standAside, 'and a result with a setup carries no stand-aside tally');

  /* an against-tape candidate is still HELD, not dropped */
  const opp = W.hgGoldUniformCompose([{ dir: 'long', entry: 100, stop: 95, t1: 110,
                                        grade: 'B', tally: 3 }],
                                     { horizon: 'SCALP', tape: 'short' });
  ok(!opp.setup, 'an against-tape candidate does not lead');
  ok(!!opp.held || (opp.heldAll && opp.heldAll.length),
     'but is still HELD and shown — hg-v593s rule is untouched');
  eq(opp.standAside.againstTape, 1, 'and counted as against-tape');
}

console.log((fail ? 'FAILED ' : 'OK ') + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
