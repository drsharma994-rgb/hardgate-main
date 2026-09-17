/* HARDGATE — three things can be true of a mechanic, and the desk rendered
   two of them as silence.

   A card carries levels, a rank and a gate verdict. Underneath it, the
   replay line is the reader's only answer to "does this thing work?", and
   until hg-v765 that line was blank for every mechanic without a baked row
   — which reads exactly like a mechanic that was measured and came back
   fine. v765 fixed half of it. This file is the other half.

   THE THREE STATES, and why the third is the one that matters:

     MEASURED    54 mechanics have a row. The card quotes it, re-prices it
                 at the venue traded, and gives a verdict against the
                 54-comparison bar.

     THIN        11 registered mechanics fired and settled under the
                 bake's 40-trade bar. Omitted from the table on purpose —
                 a record on two trades is not a record — and since v765
                 the card says so, with the count, and NO win rate.

     UNOBSERVED  12 registered mechanics produced NOT ONE ROW in a walk of
                 9,897 trades over five and a half months. SMT-DIVERGE,
                 GSR-EXTREME, COINT-SPREAD, OU-REVERT, VP-PLAYBOOK and the
                 seven part-N variants. They run on every scan and can put
                 a card on screen. Nothing is known about them at all —
                 which is a different claim from "thin" and a very
                 different one from "measured and negative".

   54 + 11 + 12 = 77, the whole register.

   THE SET IS DERIVED, NOT LISTED. hgOgUnobservedKinds subtracts the two
   baked maps from OG_MECHANICS, so registering a mechanic puts it into the
   disclosure with no list to remember. That is sound only while the two
   maps cover everything the walk saw — a kind that fired and was filtered
   away to zero surviving rows would sit in neither and be misreported as
   never seen. It cannot happen on this bake, and the equality is asserted
   below against the artifact rather than assumed, so the day a bake breaks
   it the suite says so instead of a card lying.

   Run: node tests/test-omnigold-unobserved.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
              parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Infinity, NaN,
              Float64Array, setTimeout: () => 0, clearTimeout: () => {},
              localStorage: { getItem: () => null, setItem(){}, removeItem(){} } };
ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                   querySelector: () => null, querySelectorAll: () => [] }),
                 getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                 head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                 'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js',
                 'omnigold.js']){
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const OG = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
const ART = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/omnigold-replay-evidence.json'), 'utf8'));
const MECH = (OG.match(/var OG_MECHANICS = \[([\s\S]*?)\];/)[1].match(/'[A-Z0-9-]+'/g) || [])
  .map(s => s.slice(1, -1));

console.log('== every registered mechanic is in exactly one of three states ==');
{
  const S = ctx.hgOgKindKnownState;
  const counts = { measured: 0, thin: 0, unobserved: 0, none: 0 };
  for (const k of MECH) counts[S(k) || 'none']++;
  ok(counts.none === 0, 'no registered mechanic falls through into no state at all');
  ok(counts.measured + counts.thin + counts.unobserved === MECH.length,
     `the three states partition the register (${counts.measured}+${counts.thin}+${counts.unobserved} of ${MECH.length})`);
  ok(counts.measured === 54, `54 are measured (${counts.measured})`);
  ok(counts.thin === 11, `11 fired but settled under the bar (${counts.thin})`);
  ok(counts.unobserved === 12, `and 12 were never observed at all (${counts.unobserved})`);

  /* a string that is not this desk's mechanic has nothing to disclose and
     must not be swept into "unobserved" */
  ok(S('NOT-A-MECHANIC') === null, 'an unknown key is in no state');
  ok(S('') === null && S(null) === null, 'and an empty or missing kind is null, never a throw');
}

console.log('\n== the unobserved set is derived, and the derivation is safe ==');
{
  const U = ctx.hgOgUnobservedKinds();
  ok(Array.isArray(U) && U.length === 12, `twelve mechanics have no record of any kind (${U.length})`);
  ok(U.indexOf('P8-GEO') >= 0 && U.indexOf('COINT-SPREAD') >= 0, 'including P8-GEO and COINT-SPREAD');
  ok(U.indexOf('MMOVE') < 0, 'and not a measured one');
  ok(U.indexOf('POC-REVERT') < 0, 'nor a thin one — POC-REVERT fired, it just fired too little');

  /* THE INVARIANT THE DERIVATION RESTS ON. The two baked maps must between
     them account for every kind the walk saw. If a future bake filters a
     kind down to zero surviving rows, it lands in NEITHER map and this
     check fails — which is the point: the alternative is a card claiming
     a mechanic was never seen when it fired a hundred times. */
  const seen = new Set(Object.keys(ART.sequentialBake.kindSeenRaw));
  const measured = new Set(Object.keys(ART.perKind));
  const thin = new Set(Object.keys(ART.sequentialBake.kindBelowThreshold.kinds));
  const union = new Set([...measured, ...thin]);
  ok(seen.size > 0 && union.size > 0, 'the artifact carries all three maps');
  const unaccounted = [...seen].filter(k => !union.has(k));
  ok(unaccounted.length === 0,
     'every kind the walk saw is in one of the two maps' +
     (unaccounted.length ? ' — UNACCOUNTED: ' + unaccounted.join(', ') : ''));
  ok(union.size === seen.size, `so the union IS the seen set (${union.size} kinds)`);

  /* and the register genuinely contains mechanics the walk never saw */
  const neverSeen = MECH.filter(k => !seen.has(k));
  ok(neverSeen.length === 12, 'twelve registered mechanics are absent from the walk entirely');
  ok(neverSeen.slice().sort().join(',') === U.slice().sort().join(','),
     'and the derived set is exactly those — computed, never transcribed');

  ok(!/SMT-DIVERGE'\s*,\s*'GSR-EXTREME'\s*,\s*'COINT-SPREAD'\s*\]/.test(OG),
     'there is no hand-written copy of the list in omnigold.js to go stale');
}

console.log('\n== each state renders what it actually knows ==');
{
  const L = ctx.hgOgReplayLineHtml;

  const measured = L('MMOVE');
  ok(/replay: \d+% WR/.test(measured), 'a measured mechanic quotes its record');
  ok(!/NOT MEASURED|NEVER OBSERVED/.test(measured), 'and claims neither of the other two states');

  const thin = L('POC-REVERT');
  ok(/NOT MEASURED/.test(thin), 'a thin mechanic says it was not measured');
  ok(/2 settled firing/.test(thin), 'with the count it reached');
  ok(!/%/.test(thin), 'and no win rate — a rate on two trades is an overclaim with a caveat');
  ok(!/NEVER OBSERVED/.test(thin), 'and does not claim it was never seen, because it was');

  const unseen = L('P8-GEO');
  ok(/NEVER OBSERVED/.test(unseen), 'an unobserved mechanic says so');
  ok(/did not produce a single firing/i.test(unseen), 'in as many words');
  ok(/Not a weak record: no record/.test(unseen), 'and names the distinction that matters');
  ok(/12 of 77/.test(unseen), 'with how many share its state, counted rather than written');
  ok(!/%/.test(unseen) && !/n=/.test(unseen), 'and no number that could be read as a result');
  ok(!/NaN|undefined|null/.test(unseen), 'with nothing leaked');

  ok(L('NOT-A-MECHANIC') === '', 'and an unknown key still renders nothing at all');

  /* the three lines must be distinguishable from each other by a reader,
     which was the whole failure: two of them used to be the empty string */
  const set = new Set([measured, thin, unseen]);
  ok(set.size === 3, 'the three states produce three different lines');
  ok(![...set].some(s => s === ''), 'and none of them is silence');
}

console.log('\n== the count in the copy tracks the register ==');
{
  /* hg-v764 removed a hand-counted mechanic total from the header for
     exactly this reason. The new line must not reintroduce one. */
  ok(/hgOgUnobservedKinds\(\)\.length/.test(OG), 'the line counts the derived set at render time');
  ok(/OG_MECHANICS\.length/.test(OG), 'and the register at render time');
  ok(!/12 of 77 registered/.test(OG), 'with neither number written into the string');
}

console.log('\n' + passed + ' passed, 0 failed');
