/* HARDGATE — "why don't the setups use all the indicators?"

   Asked after reading a live scan where card after card showed 10/16 checks
   with the same six unchecked. Two separate answers, and one of them was a
   real defect.

   THE ANSWER THAT WAS FINE: every setup already runs every gate. "10/16
   checks" means ten could be COMPUTED, not that six were skipped. Five of the
   six were perpetual-market reads — funding, open interest, retail ratio,
   taker flow, book depth — and the sixth was measured-edge, which reads
   UNCHECKED on purpose under the multiple-comparisons bar.

   THE DEFECT: which contracts got those five was decided by a race.

     var subset = fired.slice(0, ENRICH_MAX);   // the first 120

   Pass 1 fires roughly 490 names on a 530-contract sweep. 120 of them got the
   networked confluence and 370 got hard gates and a plan only — and the 120
   were whichever came back from the venue legs first. A strong setup on the
   400th contract lost to a mediocre one on the 3rd because of network
   ordering. That is the real reason most cards could not use most of the
   indicators.

   Ranked now on evidence already in hand, costing nothing: agreeing mechanic
   FAMILIES first (the same measure the consensus gate uses, and the one that
   most predicts a ticket), then how many mechanics fired, then how far the
   contract sits from the middle of the universe.

   AND THE MESSAGE WAS WRONG TOO. A contract past the ceiling printed "OI not
   published for this contract" — blaming the venue for a decision this tab
   made. It was never asked. Those two facts now read differently.

   Run: node tests/test-enrichment-priority.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const SRC = fs.readFileSync(path.join(ROOT, 'omniroute.js'), 'utf8');

function boot(){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', textContent: '', id: '',
                    appendChild(){}, setAttribute(){}, querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const W = boot();
const T0 = 1700000000 - (1700000000 % 86400);
const rows = (() => {
  const out = []; let p = 60000;
  for (let i = 0; i < 200; i++){ p = p * (1 + Math.sin(i / 9) * 0.004); out.push({ t: T0 + i * 3600, o: p, h: p * 1.002, l: p * 0.998, c: p, v: 1000 }); }
  return out;
})();
const HIT = { kind: 'ORB', dir: 'long', level: 60000, why: 't' };
const PERP = ['funding', 'oi-build', 'retail-contrarian', 'taker-flow', 'book-depth'];

console.log('== every setup already runs every gate ==');
{
  /* The premise of the question deserves checking: are gates being skipped? */
  const gs = W.hgOmniGates(rows, HIT, null, { stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: 2 });
  /* The 14 shared context gates live in hg-gates.js; declarations only
     (gates.push({ key:), and -2 for the two fallbacks that never fire on
     a healthy ledger. The forwarding loop's bare push is not a gate. */
  const SH4 = fs.readFileSync(path.join(ROOT, 'hg-gates.js'), 'utf8');
  const shBody4 = SH4.slice(SH4.indexOf('function hgIndicatorGates'), SH4.indexOf('G.hgBarSpacingSec'));
  const pushes = (SRC.match(/gates\.push\(\{ key:/g) || []).length
               + (shBody4.match(/gates\.push\(\{ key:/g) || []).length - 2;
  ok(gs.length === pushes, 'every gates.push in the source reaches the ledger (' + gs.length + ')');
  ok(gs.every(g => typeof g.why === 'string' && g.why.length > 0),
     'and every one states a reason, evaluated or not — none is silently skipped');
  const grade = W.hgOmniGrade(gs);
  ok(grade.total === gs.length, 'the check count on the card is out of the FULL ledger');
  ok(grade.evaluated < grade.total, 'so "10/16" means ten could be computed, not that six were skipped');
}

console.log('\n== THE DEFECT: the cap was a race, not a ranking ==');
{
  ok(!/var subset = fired\.slice\(0, ENRICH_MAX\);/.test(SRC),
     'the first-N-to-answer slice is gone');
  ok(/var meritOrder = fired\.slice\(\)\.sort\(/.test(SRC), 'the fired list is ordered before slicing');
  ok(/var subset = meritOrder\.slice\(0, ENRICH_MAX\);/.test(SRC), 'and the cap applies to the ORDERED list');
  ok(/function\(a, b\)\{ return enrichMerit\(b\) - enrichMerit\(a\); \}/.test(SRC), 'highest merit first');

  /* Exercise the scoring rule itself. */
  /* The REAL family map. A fallback of k => k would make every mechanic its
     own family and the test would measure nothing — which is exactly what it
     did on the first run. */
  ok(typeof W.hgOmniFamilyOf === 'function', 'hgOmniFamilyOf is exported, so the vote is testable');
  const famOf = W.hgOmniFamilyOf;
  const merit = f => {
    const fams = {};
    for (const h of f.hits){
      if (!h || (h.dir !== 'long' && h.dir !== 'short')) continue;
      (fams[h.dir] = fams[h.dir] || {})[famOf(h.kind)] = true;
    }
    let best = 0;
    for (const d in fams) best = Math.max(best, Object.keys(fams[d]).length);
    return best * 1000 + f.hits.length * 10;
  };
  const hit = (k, d) => ({ kind: k, dir: d, level: 1, why: 't' });
  /* Four families agreeing beats six mechanics from one family. */
  const broad = { item: { sym: 'BROAD' }, hits: [hit('ORB', 'long'), hit('SPRING', 'long'),
                                                 hit('VALUE', 'long'), hit('FVG-FILL', 'long')] };
  const deep = { item: { sym: 'DEEP' }, hits: [hit('ORB', 'long'), hit('MMOVE', 'long'), hit('PO3', 'long'),
                                               hit('NR7-BREAK', 'long'), hit('BOS-RETEST', 'long'),
                                               hit('CUSUM-SHIFT', 'long')] };
  ok(merit(broad) > merit(deep),
     'four agreeing FAMILIES outrank six mechanics of one family (' + merit(broad) + ' vs ' + merit(deep) + ')');
  /* A contract pointing both ways has no agreeing majority to reward. */
  const split = { item: { sym: 'SPLIT' }, hits: [hit('ORB', 'long'), hit('VALUE', 'short')] };
  ok(merit(broad) > merit(split), 'and a one-sided book outranks a two-sided one');
  /* More mechanics still breaks a tie between equal family counts. */
  const one = { item: { sym: 'A' }, hits: [hit('ORB', 'long')] };
  const two = { item: { sym: 'B' }, hits: [hit('ORB', 'long'), hit('MMOVE', 'long')] };
  ok(merit(two) > merit(one), 'more mechanics breaks a tie at equal family count');

  /* Ordering must be total and stable enough that the top N is deterministic. */
  const pool = [one, two, broad, deep, split];
  const sorted = pool.slice().sort((a, b) => merit(b) - merit(a));
  ok(sorted[0].item.sym === 'BROAD', 'the broadest agreement is enriched first');
  ok(sorted[sorted.length - 1].item.sym === 'A', 'and the thinnest last');
}

console.log('\n== "never asked" and "the venue publishes nothing" are different facts ==');
{
  const beyond = W.hgOmniGates(rows, HIT, null,
    { stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: 2, enriched: false });
  for (const k of PERP){
    const g = beyond.filter(x => x.key === k)[0];
    ok(!!g, k + ' is on the ledger even past the ceiling');
    ok(g.pass === null, k + ' reads UNCHECKED');
    ok(/past the per-symbol confluence ceiling/.test(g.why),
       k + ' says it was never requested, not that the venue lacks it');
    ok(!/not published|not reported|not available/.test(g.why),
       k + ' does not blame the venue for a decision this tab made');
  }

  const asked = W.hgOmniGates(rows, HIT, null,
    { stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: 2, enriched: true });
  for (const k of PERP){
    const g = asked.filter(x => x.key === k)[0];
    ok(/not published|not reported|not available/.test(g.why),
       k + ' still reports a genuine venue gap when it WAS asked (' + g.why + ')');
    ok(!/confluence ceiling/.test(g.why), k + ' does not claim it was skipped when it was not');
  }

  /* Absent flag must behave as "asked" — the flag is set by the scan, and a
     caller that does not set it is not making a claim about the ceiling. */
  const noFlag = W.hgOmniGates(rows, HIT, null, { stats: { samples: 400, hit: 0.46, expR: 0.3 }, minRr: 2 });
  ok(!/confluence ceiling/.test(noFlag.filter(x => x.key === 'funding')[0].why),
     'with no flag supplied it does not invent a ceiling explanation');
}

console.log('\n== the flag is actually set by the scan ==');
{
  ok(/ex\.enriched = Object\.prototype\.hasOwnProperty\.call\(exBySym, fitem\.sym\);/.test(SRC),
     'a contract is marked enriched iff it appears in the enriched map');
  ok(/var wasEnriched = !\(extra && extra\.enriched === false\);/.test(SRC),
     'and the gate reads it defensively');
  /* It must be declared before the FIRST gate that uses it — the funding gate
     runs before `x` is assigned, and a hoisted var read there is undefined,
     which is exactly what happened on the first attempt. */
  ok(SRC.indexOf('var wasEnriched') < SRC.indexOf("var fundOk"),
     'declared before the first gate that reads it');
}

console.log('\n== the status line stops implying the cap was arbitrary ==');
{
  ok(/chosen by how many mechanic families agree, not by which answered first/.test(SRC),
     'the caveat says how the cap was applied');
  ok(/per-symbol confluence capped at/.test(SRC), 'while still reporting that a cap exists at all');
}

console.log('\n== the cross-section reaches unenriched contracts too ==');
{
  /* The universe read costs no network, so there is no reason for it to sit
     behind the networked ceiling. */
  ok(/ex\.xs = xsRanks;/.test(SRC), 'every carded contract gets the universe ranks');
  ok(/ex\.sym = fitem\.sym;/.test(SRC), 'and its own symbol, so the rank can be found');
  ok(SRC.indexOf('ex.xs = xsRanks;') > SRC.indexOf('var ex = exBySym[fitem.sym]'),
     'set on the shared extra, after the enriched lookup, so it applies to both');
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL ENRICHMENT PRIORITY TESTS PASSED');
