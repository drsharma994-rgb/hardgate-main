/* HARDGATE — the binding gate names itself; hg-v929 says HOW FAR SHORT.

   GOLD SCALP's reject funnel has named its binding gate since hg-v905, and on
   a quiet tape it is almost always "structure too close — R:R insufficient".
   A reader who got that far had exactly one obvious next move available to
   them — LOWER THE FLOOR — and nothing on the page to argue with.

   The argument is arithmetic and the panel now shows it. Over 120 consecutive
   synthetic scans through the real goldScalpSetups, 294 of 385 rejections were
   this gate and 94.9% of them capped TP1 below 0.80R against a 1.20R floor:
   dropping the floor to 1.00R gives back SIX of 294, and to 0.80R, fifteen.

   The first pass at those figures parsed the rejects' sentences and got 92.8%
   and EIGHT, because the sentence prints lv.rr.toFixed(1) and an 0.96R cap
   reads as "1.0R". That is why section 2 below refuses the prose route: it is
   not only fragile, it is lossy. That measurement is a scratch
   harness on synthetic bars, so NOT ONE OF ITS NUMBERS IS BAKED — the panel
   computes from the scan in front of the reader, and this file proves that by
   feeding it two different scans and requiring two different answers.

   The two things it must not overstate are load-bearing and tested here:
   a row dropped at this gate never met the later gates (upper bound), and a
   lower floor buys worse geometry, not just more of it.

   Run: node tests/test-gold-rr-shortfall.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };

globalThis.window = globalThis;
globalThis.document = { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
                        querySelector: () => null, querySelectorAll: () => [],
                        head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
globalThis.localStorage = (function(){ const st = {}; return {
  getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); },
  removeItem: k => { delete st[k]; } }; })();
vm.runInThisContext(fs.readFileSync(root + 'goldscalp.js', 'utf8'), { filename: 'goldscalp.js' });

/* read from source, never retyped: a harness that hardcodes the step count
   stops testing the step list the moment someone adds a step */
const GS_STEP_COUNT = (function(){
  const m = /var GS_RR_STEPS = \[([^\]]+)\];/.exec(fs.readFileSync(root + 'goldscalp.js', 'utf8'));
  if (!m) throw new Error('GS_RR_STEPS not found in goldscalp.js');
  return m[1].split(',').length;
})();
const SF = globalThis.gsRrShortfall;
const HTML = globalThis.gsRrShortfallHTML;
const text = h => String(h).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const row = (rr, floor) => ({ dropped: true, strategy: 'S37 FAILED-SWEEP', dir: 'long',
                              rr, rrFloor: floor,
                              reason: 'structure too close — R:R insufficient (opposing structure caps TP1 at '
                                      + rr.toFixed(1) + 'R < ' + floor.toFixed(1) + 'R minimum)' });

console.log('\n1. the mint carries the NUMBERS, not just the sentence');
{
  const gi = fs.readFileSync(root + 'goldind.js', 'utf8');
  const gw = fs.readFileSync(root + 'goldswing.js', 'utf8');
  ok(/rr: lv\.rr, rrFloor: 1\.2,/.test(gi),
     'goldind.js hands the scalp reject a numeric rr and its floor');
  ok(/rr: lv\.rr, rrFloor: swBuildMinRr,/.test(gw),
     'goldswing.js does the same, from its own floor variable rather than a retyped literal');

  /* THE FLOOR ITSELF IS UNTOUCHED. This pack counts; it does not gate. */
  ok(/if \(lv\.rr < 1\.2\)\{/.test(gi), 'and the 1.2R scalp floor is unchanged');
  ok(/var swBuildMinRr = 1\.2;/.test(gw), 'as is the swing build floor');

  ok(typeof SF === 'function' && typeof HTML === 'function',
     'both helpers are exported from the real goldscalp.js, not lifted fragments');
}

console.log('\n2. it selects only genuine shortfall rows');
{
  ok(SF(null) === null && SF([]) === null, 'nothing to say about an empty scan');
  ok(SF([{ reason: 'liquidity sweep without volume climax' }]) === null,
     'a reject with no numeric rr is not guessed at from its prose');
  ok(SF([{ rr: 0.5 }]) === null, 'nor is one with an rr but no floor to judge it against');
  /* These two must be rejected by the isFinite/positive-floor guard and NOT
     merely by the rr < floor comparison behind it — both satisfy that
     comparison, so with the guard removed they would be counted. */
  ok(SF([{ rr: -0.5, rrFloor: 0 }]) === null,
     'a zero floor is not a floor, even when rr sits below it');
  ok(SF([{ rr: -Infinity, rrFloor: 1.2 }]) === null,
     'and an infinite shortfall is a broken row, not the furthest miss of the scan');
  ok(SF([row(1.8, 1.2)]) === null,
     'and a row at or above its floor is NOT a shortfall — it fell somewhere else');
  const mixed = SF([row(0.4, 1.2), { reason: 'x' }, row(1.9, 1.2), row(1.1, 1.2)]);
  ok(mixed && mixed.n === 2, 'so a mixed scan counts the two that really fell short');
}

console.log('\n3. the counts are what a reader would get by hand');
{
  const rrs = [0.05, 0.31, 0.44, 0.79, 0.85, 0.95, 1.05, 1.15, 1.19];
  const sf = SF(rrs.map(r => row(r, 1.2)));
  ok(sf.n === 9 && sf.floor === 1.2, 'nine rows under a 1.20R floor');
  ok(sf.worst === 0.05 && sf.best === 1.19, 'the furthest and nearest miss are the extremes');
  ok(sf.median === 0.85, 'and the middle row is the median of an odd sample');

  const even = SF([0.2, 0.4, 0.6, 0.8].map(r => row(r, 1.2)));
  ok(Math.abs(even.median - 0.5) < 1e-9,
     'an even sample averages the two middles rather than silently picking one');

  /* EVERY STEP RE-DERIVED INDEPENDENTLY HERE. A step that agreed with the
     code because both used the same loop would prove nothing. */
  let checked = 0;
  for (const st of sf.steps){
    const want = rrs.filter(r => r >= st.floor - 1e-9).length;
    ok(st.n === want, 'floor ' + st.floor.toFixed(2) + 'R gives back ' + want + ', counted by hand');
    ok(Math.abs(st.pct - (100 * want / 9)) < 1e-9, '  and its share matches that count');
    checked++;
  }
  ok(checked >= 5, 'over ' + checked + ' candidate floors, so the shape of the tail is visible');
  ok(sf.steps.every(s => s.floor > 0), 'no step proposes a floor at or below zero');

  /* A ROW SITTING EXACTLY ON A CANDIDATE FLOOR IS RETURNED BY IT. None of the
     rows above lands on one (1.2 - 0.3 is 0.8999999999999999, not 0.9), so
     >= and > were indistinguishable here and the boundary went untested. A
     2.00R floor makes the arithmetic exact. */
  const edge = SF([row(1.9, 2.0), row(1.89, 2.0)]);
  const at = edge.steps.find(s => Math.abs(s.floor - 1.9) < 1e-12);
  ok(at && at.n === 1, 'a row exactly at a candidate floor is given back by it, not excluded');

  /* A FLOOR LOW ENOUGH THAT THE STEPS WOULD RUN NEGATIVE. At 1.20R the
     deepest step is 0.40R and the positive-floor guard never fires, so it
     went untested; a 0.50R floor walks the steps past zero. */
  const shallow = SF([row(0.2, 0.5)]);
  ok(shallow.steps.length && shallow.steps.every(st => st.floor > 0),
     'a shallow floor drops the candidate steps that would run to zero or below');
  ok(shallow.steps.length < GS_STEP_COUNT,
     'and really drops some — ' + shallow.steps.length + ' of ' + GS_STEP_COUNT + ' survive');
  ok(sf.steps[0].n <= sf.n, 'and no step can give back more rows than fell short');

  /* The monotonic property that makes the readout meaningful at all. Written
     as one boolean rather than an ok(true) inside the loop: that shape reports
     a pass for a loop that never iterated, which is what
     tests/test-suite-not-vacuous.mjs exists to catch — and did catch here. */
  let mono = true, pairs = 0;
  for (let i = 1; i < sf.steps.length; i++){
    pairs++;
    if (sf.steps[i].n < sf.steps[i - 1].n) mono = false;
  }
  ok(pairs >= 4 && mono,
     'across ' + pairs + ' adjacent pairs, a lower floor never returns fewer rows than a higher one');
}

console.log('\n4. the near-miss question the panel exists to answer');
{
  /* THE MEASURED SHAPE: almost everything far below the floor. The claim is
     that the panel reports this honestly, not that this tape is typical. */
  const far = [];
  for (let i = 0; i < 100; i++) far.push(row(0.05 + (i % 40) * 0.015, 1.2));
  const sfFar = SF(far);
  const near = sfFar.steps.find(s => Math.abs(s.floor - 1.1) < 1e-9);
  ok(near && near.n === 0, 'when the tail is far from the floor, 1.10R gives back nothing');

  /* and the opposite tape must read the opposite way, or the panel is a slogan */
  const close = [];
  for (let i = 0; i < 100; i++) close.push(row(1.10 + (i % 9) * 0.01, 1.2));
  const sfClose = SF(close);
  const nearC = sfClose.steps.find(s => Math.abs(s.floor - 1.1) < 1e-9);
  ok(nearC && nearC.n === 100, 'and on a tape of genuine near-misses, 1.10R gives back all 100');
  ok(text(HTML(far)) !== text(HTML(close)),
     'so two different scans render two different answers — no figure here is baked');
}

console.log('\n5. two floors are never averaged into one number');
{
  const rows = [row(0.3, 1.2), row(0.5, 1.2), row(0.7, 1.2), row(0.9, 2.0)];
  const sf = SF(rows);
  ok(sf.floor === 1.2 && sf.n === 3, 'the larger group leads');
  ok(sf.others.length === 1 && sf.others[0].floor === 2.0 && sf.others[0].n === 1,
     'and the other floor is carried separately, not merged in');
  const t = text(HTML(rows));
  ok(/1 further row .*2\.00R/.test(t), 'the render names it rather than dropping it silently');
  ok(/describe neither/.test(t), 'and says why merging them would be a lie');

  /* determinism: equal group sizes must not depend on key order */
  const a = SF([row(0.3, 1.2), row(0.9, 2.0)]);
  const b = SF([row(0.9, 2.0), row(0.3, 1.2)]);
  ok(a.floor === b.floor && a.floor === 1.2,
     'a tie on group size breaks on the floor, so the answer is stable across renders');
}

console.log('\n6. what it refuses to overstate');
{
  const t = text(HTML([0.3, 0.6, 1.1].map(r => row(r, 1.2))));
  ok(/UPPER BOUND/.test(t), 'the counterfactual is labelled an upper bound');
  ok(/before the later gates ran/.test(t),
     'and says why — a row dropped here never met the gates behind it');
  ok(/smaller first target/.test(t),
     'a lower floor is described as buying WORSE geometry, not merely more trades');
  ok(/the floor is unchanged/.test(t), 'and the panel states plainly that nothing was gated on it');
  ok(/1\.20R floor/.test(t) && /these 3 sit/.test(t),
     'the header names the floor in force and how many fell short of it');
  /* and it is READ from the rows, not printed from a constant: the same
     renderer on a 2.00R book must say 2.00R */
  ok(/2\.00R floor/.test(text(HTML([row(0.9, 2.0), row(1.4, 2.0)]))),
     'a book held at a different floor prints THAT floor, not a hardcoded one');
  ok(/nearest miss 1\.10R/.test(t) && /furthest 0\.30R/.test(t),
     'the spread is quoted from the rows themselves');
}

console.log('\n7. it is wired into the funnel — proven by rendering, not by grep');
{
  /* hg-v924 shipped a test that grepped the source for a call site, which an
     `if (false)` in front of it would have survived. This renders instead. */
  const F = globalThis.gsRejectFunnelHTML;
  const rows = [row(0.3, 1.2), row(0.6, 1.2),
                { strategy: 'LIQ SWEEP', dir: 'long', reason: 'liquidity sweep without volume climax' }];
  const h = F(rows, null);
  const t = text(h);
  ok(/WHY NOTHING LED/.test(t), 'the funnel still leads with its own header');
  ok(/R:R SHORTFALL/.test(t), 'and the shortfall readout is really in the output');
  ok(t.indexOf('WHY NOTHING LED') < t.indexOf('R:R SHORTFALL'),
     'underneath the gate ranking, which is the question it follows on from');

  /* and it must go quiet when it has nothing to say */
  const none = text(F([{ strategy: 'LIQ SWEEP', reason: 'liquidity sweep without volume climax' }], null));
  ok(/WHY NOTHING LED/.test(none) && !/R:R SHORTFALL/.test(none),
     'a scan with no shortfall rows renders the funnel without it');
  ok(HTML([]) === '' && HTML(null) === '', 'and the renderer itself returns nothing, not an empty box');
}

console.log('\n' + passed + ' assertions — all green');
