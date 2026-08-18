/* HARDGATE — the desk was showing a LONG ticket and a SHORT ticket at once.

   Reported as "omnigold doesn't show correct setup". It did not. Run over 200
   synthetic gold tapes, the desk graded BOTH a long and a short to TICKET, on
   the same instrument and the same horizon, on 42% of them — each with a
   clean twelve-gate ledger, and nothing anywhere on the card saying which one
   the app believed. Average 2.5 tickets per tape.

   The cause is structural, not a typo. Every mechanic was gated in isolation:
   twenty-seven detectors each asked "is my own setup sound?" and not one
   asked "is anything else firing, and does it disagree?" Every mechanic added
   made a contradiction MORE likely, which is why two rounds of adding
   mechanics could not have fixed it and did make it worse.

   The consensus gate votes BY FAMILY, not by mechanic. PDH-SWEEP, PWH-SWEEP
   and EQH-SWEEP are three names for "liquidity taken from above and
   rejected"; they agree with each other by construction. Counting them as
   three confirmations manufactures confidence out of redundancy — the same
   multiple-comparisons error the measured-edge bar was built to stop, wearing
   a different suit.

   The minority side is vetoed. A tie vetoes BOTH: when the tape is genuinely
   two-sided the honest output is no trade, not a coin flip presented as a
   setup.

   After: 0% contradictory, 1.3 tickets per tape.

   Run: node tests/test-omnigold-consensus.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-forward.js',
                   'omniroute.js', 'omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const W = boot();
const T0 = 1700000000 - (1700000000 % 86400);
const ROWS = (() => {
  const out = []; let p = 3300;
  for (let i = 0; i < 400; i++){
    p = p * (1 + Math.sin(i / 11) * 0.0022 + Math.cos(i / 4) * 0.0009);
    out.push({ t: T0 + i * 3600, o: p * 0.9995, h: p * 1.0018, l: p * 0.9982, c: p, v: 800 + (i % 41) * 30 });
  }
  return out;
})();
const PX = ROWS[ROWS.length - 1].c;
const hit = (kind, dir) => ({ kind, dir, level: PX, why: 't' });
const gatesFor = (h, allHits) => W.hgOgGates(ROWS, h,
  { stats: { samples: 200, hit: 0.62, expR: 0.9 }, minRr: 1.5, planRisk: 12, allHits });
const con = (h, allHits) => gatesFor(h, allHits).filter(g => g.key === 'consensus')[0];
const tickets = (h, allHits) => W.hgOmniGrade(gatesFor(h, allHits)).ticket;

console.log('== the gate exists and is a real veto ==');
{
  const all = [hit('ORB', 'long'), hit('ROUND-MAGNET', 'short')];
  const g = con(all[0], all);
  ok(!!g, 'consensus is on the gold ledger');
  ok(g.info !== true, 'it is NOT an info gate — it can stand a trade aside');
  ok(g.hard === true, 'and it is hard when it has the scan to read');
}

console.log('\n== THE DEFECT: a two-sided tape can no longer ticket both ways ==');
{
  /* One family each way. Nobody wins, so nobody trades. */
  const all = [hit('ORB', 'long'), hit('ROUND-MAGNET', 'short')];
  ok(con(all[0], all).pass === false, 'the long side is vetoed');
  ok(con(all[1], all).pass === false, 'and so is the short side');
  ok(/two-sided/.test(con(all[0], all).why), 'the card says the tape is two-sided (' + con(all[0], all).why + ')');
  ok(tickets(all[0], all) === false && tickets(all[1], all) === false,
     'neither direction grades to a ticket — a tie is no trade, not a coin flip');
}

console.log('\n== the majority side survives, the minority does not ==');
{
  const all = [hit('ORB', 'long'), hit('FVG-FILL', 'long'), hit('ROUND-MAGNET', 'short')];
  const long = con(all[0], all), short = con(all[2], all);
  ok(long.pass === true, 'two families to one: the long side passes');
  ok(short.pass === false, 'and the short side is vetoed');
  ok(/minority read/.test(short.why), 'named as the minority read (' + short.why + ')');
  ok(tickets(all[2], all) === false, 'so the contradictory short never reaches the user');
}

console.log('\n== a clean one-way tape reads as the strongest case ==');
{
  const all = [hit('ORB', 'long'), hit('FVG-FILL', 'long'), hit('SPRING', 'long')];
  const g = con(all[0], all);
  ok(g.pass === true, 'three families agreeing passes');
  ok(/nothing firing against it/.test(g.why), 'and says nothing opposes it (' + g.why + ')');
  ok(/SWEEP/.test(g.why) && /TREND/.test(g.why) && /IMBALANCE/.test(g.why),
     'naming which families agree, so "confident" is auditable rather than a number');
}

console.log('\n== redundant mechanics do not manufacture agreement ==');
{
  /* THE POINT OF VOTING BY FAMILY. These four are all "liquidity taken from
     above and rejected". They agree by construction. Counting them as four
     independent confirmations is exactly the error that made a +1.47σ
     in-sample read look like evidence. */
  const stacked = [hit('PDH-SWEEP', 'short'), hit('PWH-SWEEP', 'short'),
                   hit('EQH-SWEEP', 'short'), hit('UTAD', 'short'),
                   hit('ORB', 'long')];
  const g = con(stacked[0], stacked);
  ok(/^1 family agrees/.test(g.why), 'four sweep mechanics count as ONE family (' + g.why + ')');
  ok(g.pass === false, 'so four redundant reads do not outvote one genuine disagreement');

  /* Whereas four genuinely different reads DO carry the vote. */
  const varied = [hit('PDH-SWEEP', 'short'), hit('VWAP-REVERT', 'short'),
                  hit('SMT-DIVERGE', 'short'), hit('ORB', 'long')];
  const g2 = con(varied[0], varied);
  ok(g2.nAgree === undefined, 'the gate reports through why, not a score');
  ok(g2.pass === true, 'three DIFFERENT families outvote one');
  ok(/SWEEP/.test(g2.why) && /REVERSION/.test(g2.why) && /INTERMARKET/.test(g2.why),
     'and each distinct family is named (' + g2.why + ')');
}

console.log('\n== every mechanic the desk scans has a family ==');
{
  /* A mechanic missing from the map falls into OTHER, where it would silently
     merge with every other unmapped mechanic and mis-count the vote. */
  const src = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  const listSrc = src.slice(src.indexOf('var OG_MECHANICS'), src.indexOf('var __og'));
  const mechanics = (listSrc.match(/'[A-Z0-9-]+'/g) || []).map(s => s.replace(/'/g, ''));
  ok(mechanics.length >= 27, 'read the mechanic list (' + mechanics.length + ')');
  const famSrc = src.slice(src.indexOf('var OG_FAMILY'), src.indexOf('function hgOgFamilyOf'));
  const unmapped = mechanics.filter(m => famSrc.indexOf("'" + m + "'") < 0);
  ok(unmapped.length === 0, 'every scanned mechanic is mapped to a family'
     + (unmapped.length ? ' — missing: ' + unmapped.join(', ') : ''));
}

console.log('\n== the gate never blocks when it has nothing to read ==');
{
  /* hard + UNCHECKED is WATCH, which kills the ticket. A desk that does not
     supply the scan must not have every setup silently blocked by a gate that
     could not run. */
  const g = W.hgOgGates(ROWS, hit('ORB', 'long'),
    { stats: { samples: 200, hit: 0.62, expR: 0.9 }, minRr: 1.5 }).filter(x => x.key === 'consensus')[0];
  ok(g.hard === false, 'with no scan supplied the gate is soft, not hard');
  ok(g.pass === null, 'and reads UNCHECKED rather than inventing agreement');
  ok(!/agree/.test(g.why) || /no other mechanics/.test(g.why), 'saying it had nothing to compare (' + g.why + ')');

  const alone = [hit('ORB', 'long')];
  const solo = con(alone[0], alone);
  ok(solo.pass === true, 'a lone mechanic with nothing against it passes');
  ok(/nothing firing against it/.test(solo.why), 'and says so plainly');
}

console.log('\n== degenerate scans never throw ==');
{
  for (const bad of [null, undefined, [], [null], [{}], [{ kind: 'ORB' }], [{ dir: 'long' }],
                     [{ kind: null, dir: null }], 'nonsense', 42]){
    let threw = null, g = null;
    try { g = W.hgOgGates(ROWS, hit('ORB', 'long'),
      { stats: { samples: 200, hit: 0.62, expR: 0.9 }, minRr: 1.5, allHits: bad })
      .filter(x => x.key === 'consensus')[0]; } catch (e) { threw = e; }
    ok(!threw, 'allHits=' + JSON.stringify(bad) + ' does not throw');
    ok(g && typeof g.why === 'string' && g.why.length > 0, 'and still states a reason');
    ok(!/NaN|undefined|null/.test(g.why), 'with nothing broken on the card (' + g.why.slice(0, 46) + ')');
  }
}

console.log('\n== a family that fires BOTH ways votes for neither side ==');
{
  /* My own first cut counted a split family on BOTH sides, which inflated
     each count by one and manufactured ties out of a family that simply had
     no opinion. SPRING long and ROUND-MAGNET short are both SWEEP. */
  const split = [hit('SPRING', 'long'), hit('ROUND-MAGNET', 'short'),
                 hit('VWAP-REVERT', 'long'), hit('ORB', 'short')];
  const g = con(split[0], split);
  ok(!/agree \(.*SWEEP.*\).*against \(.*SWEEP/.test(g.why),
     'SWEEP does not appear on both sides of the same sentence (' + g.why + ')');
  ok(/SWEEP is split and counted for neither/.test(g.why),
     'the split is REPORTED, not silently dropped — a divided family is worth knowing');
  ok(/1 family agrees \(REVERSION\)/.test(g.why), 'only the unambiguous families are counted');
  ok(/1 against \(TREND\)/.test(g.why), 'on both sides of the vote');
  ok(g.pass === false, 'and a genuine one-to-one tie still vetoes');

  /* With the split family removed from both counts, a real majority emerges. */
  const decided = [hit('SPRING', 'long'), hit('ROUND-MAGNET', 'short'),
                   hit('VWAP-REVERT', 'long'), hit('SMT-DIVERGE', 'long')];
  const g2 = con(decided[0], decided);
  ok(g2.pass === true, 'two unambiguous families to nothing carries the vote');
  ok(/SWEEP is split/.test(g2.why), 'while still disclosing that the sweep reads disagreed');
}

console.log('\n== the pick: one per horizon, and only ever a ticket ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/function hgOgPickFor\(ranked, horizon\)/.test(src), 'there is a per-horizon pick');
  ok(/if \(!\(c\.grade && c\.grade\.ticket\)\) continue;/.test(src),
     'it skips anything that is not a ticket — a vetoed setup is never promoted');
  ok(/if \(!c\.plan\) continue;/.test(src), 'and anything with no levels to act on');
  ok(/No ' \+ esc\(pair\[0\]\) \+ ' pick/.test(src),
     'a horizon with no ticket says so outright rather than showing a gap');

  /* The words on the card matter as much as the colour: this must not claim
     a win probability the desk cannot support. */
  ok(/STRONGEST ' \+ c\.horizon/.test(src), 'the badge says STRONGEST, not "most likely to win"');
  ok(/NOT a win probability/.test(src), 'and the card states plainly that it is not a probability');
  ok(/no settled out-of-sample record yet/.test(src),
     'quoting the measured record where one exists and saying so where none does');
  /* Comments stripped first: the file EXPLAINS why it refuses to say
     "highest probability to win", and that explanation must not itself trip
     the check. What matters is what can reach the card. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/probability to win|win rate of|% chance|most likely to win/i.test(code),
     'no win-probability language can reach the card');
}

console.log('\n== the pick colour is its own, and never the only signal ==');
{
  const src = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/og-pick-css/.test(src), 'the pick styles are injected once, scoped to this tab');
  ok(/#7c3aed/.test(src), 'in violet — a hue that means nothing else in the app');
  ok(/prefers-color-scheme:dark/.test(src), 'with a dark-theme variant so it holds on either ground');
  ok(/STRONGEST/.test(src) && /og-pick-why/.test(src),
     'and the card carries a badge and written reasons, so the meaning survives without colour');
}

console.log('\n== the ranker puts the setup the desk agrees with first ==');
{
  const rank = W.hgOmniRank;
  ok(typeof rank === 'function', 'hgOmniRank is exported');
  const mk = (kind, nAgree, evaluated) => ({
    kind, base: kind, rr: 2, grade: { ticket: true, evaluated, total: 27 },
    consensus: { nAgree, nAgainst: 0, agree: [], against: [] }
  });
  const out = rank([mk('lonely', 1, 26), mk('agreed', 4, 20)]);
  ok(out[0].kind === 'agreed', 'four agreeing families outrank a higher gate count');
  ok(out[1].kind === 'lonely', 'and the unsupported setup sorts below it');

  /* Desks that do not supply consensus must be ordered exactly as before. */
  const crypto = rank([{ kind: 'a', base: 'a', rr: 2, grade: { ticket: true, evaluated: 5 } },
                       { kind: 'b', base: 'b', rr: 2, grade: { ticket: true, evaluated: 9 } }]);
  ok(crypto[0].kind === 'b', 'without consensus the ranker still sorts on gates evaluated');
}

console.log('\n== the five new indicator reads all read, and none of them vetoes ==');
{
  const all = [hit('ORB', 'long')];
  const gs = gatesFor(all[0], all);
  for (const k of ['macd-momentum', 'bollinger-pctb', 'volume-z', 'regression-slope', 'value-area']){
    const g = gs.filter(x => x.key === k)[0];
    ok(!!g, k + ' is on the ledger');
    ok(g.info === true, k + ' is INFO — it argues, it does not veto');
    ok(g.pass !== null, k + ' returns a real read on a real series (' + g.why + ')');
    ok(!/unavailable|threw|NaN|undefined/.test(g.why), k + ' is not reporting itself broken');
  }
  const grade = W.hgOmniGrade(gs);
  const infoKeys = gs.filter(g => g.info).map(g => g.key);
  ok(grade.vetoes.every(k => infoKeys.indexOf(k) === -1), 'no info gate appears in vetoes');
  ok(grade.vetoes.indexOf('consensus') === -1 || con(all[0], all).pass === false,
     'consensus only appears in vetoes when it actually disagreed');
}

console.log('\n== a fade is not punished for being a fade ==');
{
  const all = [hit('ROUND-MAGNET', 'short')];
  const gs = gatesFor(all[0], all);
  const get = k => gs.filter(x => x.key === k)[0];
  ok(get('regression-slope').pass === true, 'the regression slope does not argue against a reversion mechanic');
  ok(/by design|what a fade wants/.test(get('regression-slope').why), 'and says why (' + get('regression-slope').why + ')');
  ok(get('bollinger-pctb').pass === true, 'nor does %B');
  ok(get('value-area').pass === true, 'nor the value area');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL OMNIGOLD CONSENSUS TESTS PASSED');
