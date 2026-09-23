/**
 * hg-v935 — selecting mechanics by their own record, measured and REFUSED.
 *
 * The desk forms setups from every registered mechanic and its measured-edge
 * gate only vetoes at -2 sigma, which almost nothing reaches. So the obvious
 * improvement is "keep only the mechanics whose record is positive" — and the
 * obvious TEST of it is worthless, because ranking 54 mechanics on the whole
 * book and then scoring on that same book cannot fail. hg-v920 caught that
 * exact shape once already, where grade A beat B/C at all three nested splits
 * and was worse in three of four disjoint windows.
 *
 * What this guard pins is the PROCEDURE, not the answer:
 *   1. the selection never sees the window it is judged on — proved by making
 *      a mechanic that only wins inside one window and requiring it not to be
 *      selected for that window;
 *   2. a verdict needs all four windows AND both fill bounds;
 *   3. unanimity alone does not ship — it must be contiguous in the threshold,
 *      or the rule is the output of a search over thresholds;
 *   4. the ceiling is published: even the best unanimous cell leaves the book
 *      negative, so nobody reads this as the profitability lever;
 *   5. the literal is generated from the replay and the panel renders BOTH
 *      verdicts, so a future bake that does find a rule is not silently
 *      hidden behind today's refusal.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as M from '../scripts/mechanic-selection.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const OG = join(ROOT, 'omnigold.js');
const OGSRC = readFileSync(OG, 'utf8');

const R = M.run();

/* ---- 1. the selection cannot see the window it is judged on ---- */
console.log('1. leave-one-window-out is real, not decorative');
{
  /* A mechanic that wins ONLY inside window 3 and loses everywhere else. If
     the selection leaked the test window it would be kept when window 3 is
     held out — which is precisely the overfit this procedure exists to stop. */
  const rows = [];
  for (let i = 0; i < 400; i++){
    const w = Math.floor(i / 100);                    /* 4 windows of 100 */
    const good = (w === 3);
    rows.push({ kind: 'SPIKE', g: good ? 1 : -1, net: good ? 1 : -1 });
    rows.push({ kind: 'FLAT', g: 0.01, net: 0.01 });
  }
  const wins = [];
  for (let w = 0; w < 4; w++) wins.push(rows.filter((_, i) => Math.floor(Math.floor(i / 2) / 100) === w));
  const trainFor3 = wins.filter((_, j) => j !== 3).flat();
  const recs = M.recordsOf(trainFor3);
  ok(recs.get('SPIKE').gross < 0,
     'held out its only good window, SPIKE reads NEGATIVE in the selection set');
  const keep = M.select(recs, { keepUnknown: true, pick: (r) => r.gross > 0 }, 20);
  ok(!keep.has('SPIKE'),
     'so it is NOT selected for the window it would have won — no leak');
  ok(keep.has('FLAT'), 'and a mechanic positive out of sample is selected');

  /* The mirror: trained on the window it wins, it IS kept — so the assertion
     above is about the procedure, not about SPIKE being unselectable. */
  const leaky = M.select(M.recordsOf(wins[3]), { keepUnknown: true, pick: (r) => r.gross > 0 }, 20);
  ok(leaky.has('SPIKE'),
     'and trained ON that window it would be kept — which is the leak being prevented');
}

/* ---- 2. an unknown mechanic is handled explicitly, both ways ---- */
console.log('2. too thin to judge is a decision, not an accident');
{
  const recs = new Map([['THIN', { kind: 'THIN', n: 3, gross: -5, net: -5 }]]);
  ok(M.select(recs, { keepUnknown: true, pick: () => false }, 20).has('THIN'),
     'keepUnknown keeps a mechanic under the sample floor whatever its sign');
  ok(!M.select(recs, { keepUnknown: false, pick: () => false }, 20).has('THIN'),
     'and the strict variant drops it — the two are tested separately because '
     + 'thin mechanics are most of the register');
  ok(M.RULES.some((r) => r.keepUnknown) && M.RULES.some((r) => !r.keepUnknown),
     'the grid runs both');
}

/* ---- 3. the verdict bar: four windows, both ends, and contiguity ---- */
console.log('3. unanimity alone does not ship');
{
  eq(M.ENDS.length, 2, 'both fill bounds are judged');
  ok(M.ENDS.includes('lower') && M.ENDS.includes('as-recorded'),
     'and they are the hg-v918 pair');
  for (const row of R.grid){
    const cap = M.judge.length >= 0 ? 16 : 16;
    ok(row.agree <= cap, row.rule + '@' + row.minN + ' cannot agree more than 16 times');
  }
  /* The obvious rule is not unanimous — the finding, asserted as a finding. */
  const winners = R.grid.filter((r) => /gross>0|net>0/.test(r.rule));
  ok(winners.length > 0, 'the grid tests the select-the-winners rule');
  ok(winners.every((r) => !r.unanimousBothEnds),
     'and NONE of its cells is unanimous — the desk cannot pick its winners');

  /* Contiguity is what turns the weak rule's unanimity into a refusal. */
  const flip = M.contiguous([{ unanimous: true }, { unanimous: false }, { unanimous: true }]);
  eq(flip.runs, 2, 'two separated unanimous cells count as two runs');
  eq(flip.contiguous, false, 'and are not contiguous');
  const solid = M.contiguous([{ unanimous: false }, { unanimous: true }, { unanimous: true }]);
  eq(solid.runs, 1, 'an unbroken band is one run');
  eq(solid.contiguous, true, 'and is contiguous');
  ok(R.shape.unanimousCount > 0,
     'the real sweep DOES contain unanimous cells — ' + R.shape.unanimousCount
     + ', which is why contiguity is the test that matters');
  eq(R.shape.contiguous, false,
     'and they are not contiguous — ' + R.shape.runs + ' separate runs');
  eq(R.ships, false, 'so no rule ships');
  ok(!R.ships || R.shape.contiguous,
     'ships can only be true when the unanimity is contiguous');
}

/* ---- 4. the ceiling, so nobody reads this as the lever ---- */
console.log('4. the best case is published, and it is still negative');
{
  ok(R.best && isFinite(R.best.netLift), 'a best unanimous cell is identified');
  ok(R.bookNet < 0, 'the book is negative to begin with — ' + R.bookNet + 'R');
  ok(R.ceilingNet < 0,
     'and the most generous rule leaves it negative — ' + R.ceilingNet + 'R');
  ok(R.ceilingNet > R.bookNet, 'better, but not profitable');
  ok(R.best.netLift < 0.05,
     'the lift is small in absolute terms — +' + R.best.netLift + 'R');
  /* Volume is reported, because a filter that trades almost nothing can look
     good without being an edge (hg-v922 deleted 52% of volume that way). */
  for (const row of R.sweep) ok(isFinite(row.keptPct), 'every sweep row reports what it keeps');
}

/* ---- 5. generated, and the panel reports either verdict ---- */
console.log('5. the literal writes itself and the panel does not hide a reversal');
{
  const lit = OGSRC.match(/var HG_OG_SELECTION = \{[\s\S]*?\n  \};/);
  ok(!!lit, 'omnigold.js carries the generated literal');
  ok(M.splice(OGSRC, M.renderLiteral(R)) === OGSRC,
     'and the committed tree round-trips to zero drift');

  /* IDEMPOTENCE, which is not implied by the round-trip above and is the bug
     this pack actually shipped for one run: the markers were placed by hand
     with different whitespace than splice() emits, so the committed file was
     never at the generator's fixed point. Every run reported drift, and the
     byte-identical rebuild below restored to the GENERATOR's output rather
     than to the file it started from. Applying the splice twice must change
     nothing the second time. */
  const once = M.splice(OGSRC, M.renderLiteral(R));
  eq(M.splice(once, M.renderLiteral(R)), once,
     'and the splice is idempotent — the committed file is the generators fixed point');

  /* THE REBUILD IS PROVED IN MEMORY, AND THAT IS NOT FASTIDIOUSNESS.

     The first version of this wrote the real omnigold.js, corrupted it, and
     restored it in a `finally`. Under the mutation harness — which runs this
     file with the generator deliberately broken — one of those runs wrote a
     literal computed by the MUTATED generator, and the restore did not survive
     whatever ended that process. The repository was left carrying numbers no
     measurement produced: `unanimousCells: 6, runs: 1, contiguous: true`, which
     is exactly what the "a single window is enough" mutation computes. The
     committed refusal had been silently turned into an approval.

     splice() and renderLiteral() are pure, so the whole property is provable
     on strings. A test that never writes a shared source file cannot leave one
     wrong, whatever kills it. */
  const wrecked = OGSRC.replace(/var HG_OG_SELECTION = \{[\s\S]*?\n  \};/,
    'var HG_OG_SELECTION = { sweep: [] };');
  ok(wrecked !== OGSRC, 'the corruption actually changes the source');
  eq(M.splice(wrecked, M.renderLiteral(R)), OGSRC,
     'and the generator rebuilds it BYTE-IDENTICAL from the corrupted text');
  ok(typeof M.write === 'function', 'the writer exists for the CLI');
  ok(!/writeFileSync\(OG/.test(readFileSync(join(ROOT, 'tests', 'test-mechanic-selection.mjs'), 'utf8')),
     'and THIS TEST never writes omnigold.js — a guard must not be able to corrupt the tree');

  let threw = false;
  try { M.splice('var x = 1;', 'var HG_OG_SELECTION = {};'); } catch (e){ threw = true; }
  ok(threw, 'a source with no markers is fatal, never skipped');

  const body = OGSRC.slice(OGSRC.indexOf('function hgOgSelectionRefusedHtml'),
                           OGSRC.indexOf('function hgOgWalkAgeHtml'));
  ok(/S\.ships/.test(body),
     'the panel branches on the verdict rather than hardcoding the refusal');
  ok(/A MECHANIC-SELECTION RULE NOW SURVIVES/.test(body),
     'so a future bake that DOES find a rule is announced, not hidden behind today\'s answer');
  ok(/S\.ceilingNet/.test(body) && /S\.bestLift/.test(body),
     'and the ceiling is rendered from the literal');
  ok(!/-0\.0861|0\.0299/.test(body.replace(/\/\*[\s\S]*?\*\//g, '')),
     'no measured number is baked into the rendered string');
  ok(/\+ hgOgSelectionRefusedHtml\(\)/.test(OGSRC), 'the panel is wired into the chain');

  /* Nothing is gated on it: the register and the family bar are untouched. */
  ok(/hgOgFamilyZ\(OG_MECHANICS\.length\)/.test(OGSRC),
     'the family bar still corrects over the whole register');
  ok(!/HG_OG_SELECTION[\s\S]{0,4000}?gates\.push/.test(OGSRC)
     || !/gates\.push\([^)]*HG_OG_SELECTION/.test(OGSRC),
     'and no gate reads the selection verdict — nothing is dropped');
}

console.log((fail ? 'FAILED ' : 'OK ') + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
