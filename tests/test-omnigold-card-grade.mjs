/* HARDGATE — OMNIGOLD's own cards carry a grade, and it does not saturate.

   THE GAP. Only ENGINE picks bridged from the GOLD SCALP/SWING tabs wore an
   A/B/C chip. The desk's own mechanic cards printed "50/54 checks · VETO" and
   no letter, so a reader comparing an ORB against a STRUCT-BOS had no
   glanceable quality read — reported from the live tab as "no grading?".

   WHY NOT THE ENGINE'S TALLY. The engine grades on a RAW COUNT (A at eight or
   more agreeing reads). Reconstructed over 1,000 PAXG bars per horizon that
   put 97% of setups in grade A, with a non-monotone hit rate across buckets
   (34.6% at tally 8, 57.6% at 10, 20.0% at 11, 26.6% at 12). A letter that
   reads A for almost everything grades nothing, and on a live card it would
   read as endorsement.

   So the card letter comes from the two NORMALISED terms the balance score
   already computes — net agreeing families over families that voted, and net
   agreeing indicator reads over reads that answered. Both live in [-1,1].
   The assertions below are about non-saturation and honest degradation:
   the letters must actually separate, an unread ledger must produce NO letter
   rather than a default one, and a VETO must still outrank any grade.

   Run: node tests/test-omnigold-card-grade.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js','hg-forward.js',
                   'plans.js','hg-gates.js','hg-plan.js','structure-levels.js','best-levels.js',
                   'gold-best-levels.js','regime.js','goldind.js','pinegoldmath.js','omniroute.js','omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}
const W = boot();
ok(typeof W.hgOgConfluenceGrade === 'function', 'hgOgConfluenceGrade is exported');

/* a candidate shaped like the ones the tab renders */
const mk = (nAgree, nAgainst, infoPass, infoFail) => ({
  horizon: 'SCALP', dir: 'short', kind: 'ORB',
  plan: { entry: 4604, stop: 4649, t1: 4514, rr1: 2 },
  grade: { ticket: false, total: 54, evaluated: 50 },
  consensus: { nAgree, nAgainst, nSplit: 0 },
  distAtr: 0.4,
  gates: [].concat(
    Array.from({ length: infoPass }, (_, i) => ({ key: 'p' + i, hard: false, info: true, pass: true, why: '' })),
    Array.from({ length: infoFail }, (_, i) => ({ key: 'f' + i, hard: false, info: true, pass: false, why: '' }))
  )
});

console.log('\n== the cuts are measured quartiles, so the letters separate ==');
{
  /* p25 0.43, median 0.60, p75 0.69 over 3,769 real gold setups (1,924 scalp,
     1,845 swing). A is top-quartile confluence FOR THIS INSTRUMENT, not an
     arbitrary line — which is the mistake that let a raw tally grade 97% of
     setups A. */
  ok(W.hgOgConfluenceGrade(mk(0, 0, 34, 3)) === 'A', 'top-quartile indicator agreement is an A');
  ok(W.hgOgConfluenceGrade(mk(0, 0, 24, 13)) === 'D', 'bottom-quartile is a D');

  /* NOT ALL ONE LETTER — the failure mode both earlier attempts had, in
     opposite directions. */
  const spread = new Set([mk(0,0,34,3), mk(0,0,31,6), mk(0,0,28,9), mk(0,0,24,13)]
    .map(c => W.hgOgConfluenceGrade(c)));
  ok(spread.size >= 3,
     'four confluence levels produce at least three distinct letters (' + [...spread].sort().join('') + ')');
}

console.log('\n== a degenerate voter pool cannot define the letter ==');
{
  /* hgOgConsensusVoters drops every setup fighting the DAILY trend before the
     vote. On a day when the daily is up but the tape reads short, exactly one
     family votes and the family term pins to -1.000 for every short on the
     board. Live, five shorts fired against one long: all five graded D while
     the lone long took an A. That inversion is what this guards. */
  const lone = W.hgOgConfluenceGrade(mk(0, 1, 27, 10));       /* famDen = 1 */
  const noneVoting = W.hgOgConfluenceGrade(mk(0, 0, 27, 10)); /* famDen = 0 */
  ok(lone === noneVoting,
     'one opposing family is treated as no evidence, exactly like none (' + lone + ')');
  ok(lone !== 'D', 'so it cannot force a D on a card with 27 of 37 reads behind it');

  /* with a real denominator the family term is allowed to matter — bounded */
  const up = W.hgOgConfluenceGrade(mk(2, 0, 28, 9));
  const dn = W.hgOgConfluenceGrade(mk(0, 2, 28, 9));
  ok(up !== dn, 'with two or more voting families, agreement moves the letter (' + up + ' vs ' + dn + ')');
  const SRC0 = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/0\.15 \* fam/.test(SRC0),
     'and it is a bounded adjustment — about one band — never half the score');
}

console.log('\n== an unread ledger gets no letter at all ==');
{
  /* Without indicator reads the score rides entirely on the family term and a
     lone mechanic would print C on no evidence. Silence beats a fake grade. */
  ok(W.hgOgConfluenceGrade(mk(1, 0, 0, 0)) === '', 'no indicator reads -> no grade');
  ok(W.hgOgConfluenceGrade(mk(1, 0, 3, 1)) === '', 'too few reads (4) -> still no grade');
  ok(W.hgOgConfluenceGrade(mk(1, 0, 4, 1)) !== '', 'five reads is enough to grade');
  for (const bad of [null, undefined, {}, { consensus: null, gates: null }]){
    ok(W.hgOgConfluenceGrade(bad) === '', 'malformed candidate ' + JSON.stringify(bad) + ' -> no grade, no throw');
  }
}

console.log('\n== the chip renders on the desk\'s own cards, not just engine picks ==');
{
  const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/hgOgConfluenceGrade\(row, tape\)/.test(SRC), 'the card renderer asks for a letter');
  ok(/hgOgGradeChipHtml\(lg, \{ large: true \}\)/.test(SRC), 'and draws the chip when there is one');
  /* engine picks must keep their own grade — this must not overwrite it */
  ok(/row\.engineGrade \|\| 'A'/.test(SRC), 'engine picks still use engineGrade');
}

console.log('\n== a VETO still outranks any letter ==');
{
  const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/isWatch \? ' · VETO' : ''/.test(SRC),
     'the VETO badge is emitted independently of the grade — a letter is not permission');
  ok(/grade: c\.engineGrade \|\| \(c\.grade && c\.grade\.letter\) \|\| hgOgConfluenceGrade\(c\)/.test(SRC),
     'and the letter is recorded forward, so whether A beats C gets answered out-of-sample');
}

console.log('\nomnigold card grade: ' + passed + ' checks passed');
