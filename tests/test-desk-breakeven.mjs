/* HARDGATE — a win rate with no bar beside it invites the wrong reading.

   A win rate on its own is not a fact about edge: shrink the target and it
   rises for free. What matters is the win rate MINUS the breakeven its own
   planned R:R demands — and the two gold desks do not plan at the same R:R,
   so the same percentage means opposite things on the two tabs.

   Measured, and the desks are NOT in the same state:
     GOLD SCALP  43.4% vs 40.0% needed -> +3.4 .. +4.4 pts   CLEARS both bounds
     OMNIGOLD    30.4% vs 33.3% needed -> -3.0 .. +5.3 pts   SIGN FLIPS

   "Flips" is a different claim from "a bit worse": OMNIGOLD's edge is
   UNPROVEN in a nameable way, and 672 trades (8.3% of its filled book) are
   the ones the two fill bounds disagree about, against 23 (0.9%) on GOLD
   SCALP. The cause is resolution, not strategy — 1h bars vs 15m.

   Every literal below is re-derived from the committed replay here, so a
   re-bake that moves a number and forgets the panel fails this file rather
   than shipping a stale claim.

   Run: node tests/test-desk-breakeven.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run as derive, deskBreakeven, plannedRr } from '../scripts/desk-breakeven.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };

globalThis.window = globalThis;
globalThis.document = { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
                        querySelector: () => null, querySelectorAll: () => [],
                        head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
globalThis.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
vm.runInThisContext(fs.readFileSync(root + 'indicators.js', 'utf8'), { filename: 'indicators.js' });
try { vm.runInThisContext(fs.readFileSync(root + 'goldind.js', 'utf8'), { filename: 'goldind.js' }); }
catch (e) { throw new Error('FAIL: goldind.js did not load — ' + e.message); }

const LIT = globalThis.HG_GOLD_DESK_BREAKEVEN;
const HTML = globalThis.hgGoldBreakevenHtml;
const ROW = globalThis.hgGoldBreakevenRow;
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const DERIVED = derive();

console.log('\n1. every shipped literal is re-derived from the replay');
{
  ok(LIT && LIT.scalp && LIT.omnigold, 'the block carries both desks');
  const fields = ['published', 'filled', 'unfilled', 'bothTouch', 'timeout'];
  const rounded = ['unfilledPct', 'plannedRr', 'breakevenPct', 'winLowerPct', 'winUpperPct',
                   'edgeLowerPts', 'edgeUpperPts', 'bothTouchPct', 'timeoutPct'];
  for (const desk of ['scalp', 'omnigold']){
    for (const f of fields)
      ok(LIT[desk][f] === DERIVED[desk][f],
         desk + '.' + f + ' = ' + LIT[desk][f] + ', re-derived from ' + DERIVED[desk].src);
    for (const f of rounded){
      const want = Number(DERIVED[desk][f].toFixed(f === 'plannedRr' ? 2 : 1));
      ok(Math.abs(LIT[desk][f] - want) < 1e-9,
         '  ' + desk + '.' + f + ' = ' + LIT[desk][f] + ' matches to the digit it prints');
    }
    ok(LIT[desk].verdict === DERIVED[desk].verdict,
       desk + ' verdict "' + LIT[desk].verdict + '" is DERIVED, not asserted');
  }
}

console.log('\n2. the arithmetic, checked independently of the generator');
{
  for (const desk of ['scalp', 'omnigold']){
    const d = LIT[desk];
    /* breakeven at R:R r is 1/(1+r) — recomputed here rather than trusted */
    ok(Math.abs(d.breakevenPct - 100 / (1 + d.plannedRr)) < 0.05,
       desk + ': ' + d.breakevenPct + '% really is 1/(1+' + d.plannedRr + ')');
    ok(Math.abs(d.edgeLowerPts - (d.winLowerPct - d.breakevenPct)) < 0.11,
       '  and the edge is the win rate MINUS that bar, not the win rate');
    ok(Math.abs(d.edgeUpperPts - (d.winUpperPct - d.breakevenPct)) < 0.11,
       '  at the other bound too');
    ok(d.winUpperPct >= d.winLowerPct,
       '  the upper bound is never below the lower one');
    ok(d.filled + d.unfilled === d.published, '  filled + unfilled accounts for every published plan');
  }
  /* the verdict word must follow the two edges, in every direction */
  ok(deskBreakeven([{ outcome: 'win', entry: 100, stop: 99, t1: 101.5 },
                    { outcome: 'win', entry: 100, stop: 99, t1: 101.5 },
                    { outcome: 'loss', entry: 100, stop: 99, t1: 101.5 }]).verdict === 'clears',
     'a book above its bar at both ends reads CLEARS');
  ok(deskBreakeven([{ outcome: 'loss', entry: 100, stop: 99, t1: 101.5 },
                    { outcome: 'loss', entry: 100, stop: 99, t1: 101.5 },
                    { outcome: 'loss', entry: 100, stop: 99, t1: 101.5 }]).verdict === 'below',
     'a book below it at both ends reads BELOW');
  const flip = deskBreakeven([{ outcome: 'loss (both-touch)', entry: 100, stop: 99, t1: 101.5 },
                              { outcome: 'loss (both-touch)', entry: 100, stop: 99, t1: 101.5 },
                              { outcome: 'win', entry: 100, stop: 99, t1: 101.5 },
                              { outcome: 'loss', entry: 100, stop: 99, t1: 101.5 },
                              { outcome: 'loss', entry: 100, stop: 99, t1: 101.5 }]);
  ok(flip.verdict === 'flips', 'and one the both-touch rows carry across the bar reads FLIPS');
  ok(plannedRr({ entry: 100, stop: 98, t1: 104 }) === 2, 'planned R:R is reward over risk, not a stamp');
}

console.log('\n3. the finding itself — the two desks differ, and the panel says so');
{
  ok(LIT.scalp.verdict === 'clears' && LIT.omnigold.verdict === 'flips',
     'GOLD SCALP clears its own bar; OMNIGOLD flips between bounds');
  ok(LIT.omnigold.bothTouchPct > LIT.scalp.bothTouchPct * 5,
     'OMNIGOLD carries ' + LIT.omnigold.bothTouchPct + '% ambiguous rows against GOLD SCALP\'s '
     + LIT.scalp.bothTouchPct + '% — the reason the bounds disagree');
  ok(LIT.omnigold.tf === '1h' && LIT.scalp.tf === '15m',
     'and the two desks resolve on different bars, which is the stated mechanism');
}

console.log('\n4. the panel reports the desk it is asked about, with the bar');
{
  ok(ROW('scalp') === LIT.scalp && ROW('goldscalp') === LIT.scalp && ROW('gold scalp') === LIT.scalp,
     'the desk name is read tolerantly');
  ok(ROW('omnigold') === LIT.omnigold && ROW('og') === LIT.omnigold, 'on both desks');
  ok(ROW('nonsense') === null && ROW(null) === null && ROW(undefined) === null,
     'and an unknown name is NOTHING — never silently the other desk\'s book');
  ok(HTML('nonsense') === '' && HTML(null) === '', 'so the panel renders nothing rather than a wrong desk');

  const s = text(HTML('scalp')), o = text(HTML('omnigold'));
  ok(/GOLD SCALP vs ITS OWN BREAKEVEN/.test(s) && /CLEARS ITS OWN BAR AT BOTH FILL BOUNDS/.test(s),
     'the scalp panel leads with its verdict');
  ok(/OMNIGOLD vs ITS OWN BREAKEVEN/.test(o) && /SIGN FLIPS BETWEEN THE FILL BOUNDS/.test(o)
     && /edge UNPROVEN/.test(o),
     'and OMNIGOLD says its edge is UNPROVEN, not merely small');

  /* the bar must appear beside the rate, on both, or the panel is the thing
     it exists to prevent */
  /* written as one regex: the `||` that was here made the assertion pass on
     either alternative, which is a check that cannot fail in the way that
     matters. The rate and the bar must appear in the SAME sentence. */
  ok(/Planned R:R 1\.50 needs 40\.0% to break even\. Measured 43\.4%/.test(s),
     'the scalp rate is printed in the same breath as the 40.0% its R:R demands');
  ok(/Planned R:R 2\.00 needs 33\.3% to break even\. Measured 30\.4%/.test(o),
     'and OMNIGOLD the same, so neither number can be read without the other');
  ok(/43\.4%/.test(s) && /30\.4%/.test(o), 'each desk prints its own measured rate');
  ok(/rises for free if the target shrinks/.test(s), 'and says why a bare win rate is not evidence');

  /* the comparison is the point: each panel names the OTHER desk */
  ok(/OMNIGOLD plans at 2\.00/.test(s), 'the scalp panel names OMNIGOLD\'s different bar');
  ok(/GOLD SCALP plans at 1\.50/.test(o), 'and OMNIGOLD names GOLD SCALP\'s');

  /* THE SIGN IS THE WHOLE CLAIM. A negative edge rendered with a '+' turns
     the one desk whose edge is unproven into the one that clears — so the
     glyph is asserted, not just the digits. */
  ok(/\u22123\.0 pts to \+5\.3 pts/.test(o),
     'OMNIGOLD prints its lower edge as MINUS 3.0, not +3.0');
  ok(/\+3\.4 pts to \+4\.4 pts/.test(s), 'and GOLD SCALP prints both of its as positive');
  ok(/\u22123\.0 pts to \+5\.3 pts/.test(s),
     'the scalp panel quotes OMNIGOLD\'s negative edge with its sign intact too');

  ok(/672/.test(o) && /8\.3%/.test(o), 'OMNIGOLD counts the trades its bounds disagree about');
  ok(/resolution artifact, not a difference in edge/.test(o),
     'and attributes the gap to bar length rather than to edge');
  ok(/1765 of 9897 published plans \(17\.8%\) never filled/.test(o),
     'the unfill rate is stated — 1 in 6 published plans never triggers');
  ok(/Nothing on this desk is gated on any of it/.test(s) && /Nothing on this desk is gated/.test(o),
     'and both say plainly that no threshold moved');
  ok(/node scripts\/desk-breakeven\.mjs/.test(o), 'with the command that re-derives it');
}

console.log('\n5. wired into both tabs, and failing open');
{
  const gs = fs.readFileSync(root + 'goldscalp.js', 'utf8');
  const og = fs.readFileSync(root + 'omnigold.js', 'utf8');
  ok(/\+ gsBreakevenHtml\(\) \+ bannerHTML/.test(gs), 'GOLD SCALP renders it above the cards');
  ok(/\+ gsBreakevenHtml\(\)\n\s+\+ \(whySilent/.test(gs), 'and on the silent branch too');
  ok(/function gsBreakevenHtml\(\)\{[\s\S]{0,400}?catch\s*\(e\)\s*\{ return ''; \}/.test(gs),
     'through a shim that returns \'\' when goldind is absent rather than throwing');
  ok(/function hgOgBreakevenPanelHtml\(\)\{[\s\S]{0,400}?catch\s*\(e\)\s*\{ return ''; \}/.test(og),
     'OMNIGOLD does the same');
  const iBe = og.indexOf('+ hgOgBreakevenPanelHtml()');
  const iAge = og.indexOf('+ hgOgWalkAgeHtml()');
  ok(iBe > 0 && iAge > iBe,
     'and it LEADS the OMNIGOLD panel chain — the unproven-edge statement comes before the numbers');

  /* ONE literal, not two: a second copy drifts the first time either desk
     is re-baked (the hg-v921 lesson) */
  ok(!/HG_GOLD_DESK_BREAKEVEN\s*=/.test(og) && !/HG_GOLD_DESK_BREAKEVEN\s*=/.test(gs),
     'neither desk keeps its own copy of the numbers');
  ok(/var HG_GOLD_DESK_BREAKEVEN = \{/.test(fs.readFileSync(root + 'goldind.js', 'utf8')),
     'they share the one in goldind.js');
}

/* an honest sign-off: this line used to read "all green" unconditionally,
   so a file with failures still printed a pass banner under them */
if (process.exitCode) console.error('\n' + passed + ' passed, but this file FAILED — see above');
else console.log('\n' + passed + ' assertions — all green');
