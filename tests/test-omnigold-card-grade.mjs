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

console.log('\n== the letters separate rather than all reading A ==');
{
  ok(W.hgOgConfluenceGrade(mk(4, 0, 30, 2)) === 'A', 'strong agreement both ways is an A');
  ok(W.hgOgConfluenceGrade(mk(0, 4, 2, 30)) === 'D', 'strong disagreement both ways is a D');
  const mid = W.hgOgConfluenceGrade(mk(2, 1, 20, 12));
  ok(mid === 'B' || mid === 'C', 'a mixed card lands in the middle (' + mid + ')');

  /* THE SATURATION TEST — this is the failure the engine tally had. The card
     the user was looking at: 0 families agreeing, 26 of 37 indicators with. */
  const live = W.hgOgConfluenceGrade(mk(0, 0, 26, 11));
  ok(live !== 'A', 'the live card (0 families, 26/37 indicators) is NOT an A — no family agreed with it');
  ok(live === 'C' || live === 'B', 'it grades in the middle instead (' + live + ')');
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
