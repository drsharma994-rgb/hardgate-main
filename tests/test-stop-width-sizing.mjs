/* HARDGATE — the other thing you can do with a factor, measured and REFUSED.

   hg-v922 judged twenty signal-time factors and found exactly one that
   separates outcomes on four disjoint windows at both fill bounds: STOP WIDTH.
   Every test since has treated it as a REJECT. That is one of two things you
   can do with a factor, and the other had never been measured: keep the trade
   and SIZE it. A reject throws the trade's information away with its risk; a
   weight keeps both, so if the relationship is real and graded, a ramp should
   beat a cliff and both should beat flat.

   MEASURED — and the hypothesis FAILS. Seven schemes x 4 disjoint windows x 2
   fill bounds x gross+net = 16 tests each, on both desks:

     GOLD SCALP  best is cliff050 at 14/16 ... and it keeps 9% OF THE RISK
     OMNIGOLD    best is cliff050 at  8/16
     every GRADED scheme (ramp / half-size / sqrt) scores 7-10 of 16

   So the graded schemes are no better than the cliffs, and NOTHING is
   unanimous. The pooled whole-book numbers look encouraging — ramp050 takes
   GOLD SCALP from -0.157R to -0.091R — which is exactly the trap hg-v920 was
   written to catch: an improvement that does not survive being asked the same
   question in four separate windows. NO SIZING RULE SHIPS.

   The denominator is load-bearing and tested below: expectancy is measured
   per unit of RISK DEPLOYED, so a scheme cannot look good merely by trading
   less. cliff050's 9% is the number that makes that concrete.

   Run: node tests/test-stop-width-sizing.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run, book, expectancy, judge, stopPct, costRxm, SCHEMES, WINDOWS, XM_RT_PCT }
  from '../scripts/stop-width-sizing.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let passed = 0;
const ok = (c, m) => { if (c){ passed++; console.log('  ok   ' + m); }
                       else { console.error('  FAIL ' + m); process.exitCode = 1; } };

console.log('\n1. the factor and its cost identity');
{
  ok(Math.abs(stopPct({ entry: 100, stop: 99.5 }) - 0.5) < 1e-9, 'stop width is a percentage of entry');
  ok(Math.abs(stopPct({ entry: 100, stop: 100.5 }) - 0.5) < 1e-9, 'and it is unsigned — a short is the same width');
  ok(!isFinite(stopPct({ entry: 0, stop: 1 })), 'a zero entry has no width rather than an infinite one');
  /* hg-v919: costR = rtCost / stopPct, exactly */
  ok(Math.abs(costRxm({ entry: 100, stop: 99.5 }) - XM_RT_PCT / 0.5) < 1e-12,
     'cost in R is the venue round trip over the stop width — the hg-v919 identity');
  ok(costRxm({ entry: 100, stop: 99.0 }) < costRxm({ entry: 100, stop: 99.9 }),
     'so a wider stop costs LESS in R, which is why tight stops are the cohort under test');
}

console.log('\n2. expectancy is per unit of RISK DEPLOYED, not per trade');
{
  const rows = [{ sp: 1, gross: 1, net: 1 }, { sp: 1, gross: -1, net: -1 }];
  ok(expectancy(rows, () => 1, 'net').e === 0, 'flat weighting is the plain mean');
  ok(expectancy(rows, () => 0.5, 'net').e === 0, 'and halving EVERY weight changes nothing — it is a ratio');

  /* THE WEIGHTED MEAN IS NOT THE PLAIN MEAN, and dividing by the trade COUNT
     instead of the risk DEPLOYED silently turns one into the other. Weights
     1 and 0.25 on +1 and -1 give 0.75/1.25 = 0.6; by count it would be
     0.75/2 = 0.375. Both are numbers, only one is an expectancy. */
  const uneven = [{ sp: 1, gross: 1, net: 1 }, { sp: 0.1, gross: -1, net: -1 }];
  const wUneven = sp => (sp >= 1 ? 1 : 0.25);
  ok(Math.abs(expectancy(uneven, wUneven, 'net').e - 0.6) < 1e-12,
     'expectancy divides by risk deployed (0.6), not by trade count (0.375)');
  ok(Math.abs(expectancy(uneven, wUneven, 'net').risk - 1.25) < 1e-12,
     'and the risk figure is the sum of the weights that were actually put up');

  /* THE DENOMINATOR IS THE POINT. A scheme that skips the loser must show a
     smaller risk figure, or it is being credited for capital it never put up. */
  const skipLoser = expectancy(rows, sp => 1, 'net');
  const onlyWinner = expectancy([rows[0]], () => 1, 'net');
  ok(onlyWinner.risk < skipLoser.risk * 1.0000001 && onlyWinner.risk === 1,
     'trading one of two deploys half the risk, and the figure records it');
  ok(expectancy(rows, sp => 0, 'net').risk === 0, 'a scheme that trades nothing deploys nothing');
  ok(!isFinite(expectancy(rows, () => 0, 'net').e), 'and has no expectancy rather than a flattering zero');
}

console.log('\n3. the schemes are what they claim to be');
{
  const by = {};
  SCHEMES.forEach(s => { by[s.key] = s; });
  ok(by.flat.w(0.01) === 1 && by.flat.w(9) === 1, 'flat is the baseline, 1 everywhere');
  ok(by.cliff028.w(0.27) === 0 && by.cliff028.w(0.28) === 1, 'a cliff is a reject, and it is inclusive at the bar');
  ok(by.cliff050.w(0.49) === 0 && by.cliff050.w(0.50) === 1, 'the same at 0.50');
  ok(by.ramp050.w(0.50) === 1 && by.ramp050.w(1.0) === 1, 'a ramp tops out at full size');
  ok(by.ramp050.w(0.0001) === 0.25, 'and floors at a quarter rather than at zero — that is what makes it NOT a reject');
  ok(by.ramp050.w(0.25) > by.ramp050.w(0.10), 'it is monotone in stop width');
  ok(by.halfTight.w(0.1) === 0.5 && by.halfTight.w(0.9) === 1, 'half-size is the crude version of the same idea');
  SCHEMES.forEach(s => {
    const vals = [0.001, 0.05, 0.2, 0.28, 0.5, 1, 5].map(s.w);
    ok(vals.every(v => v >= 0 && v <= 1), s.key + ' stays a weight in [0,1] across the range');
  });
}

console.log('\n4. the fill bound moves the rows it should, and only those');
{
  const rows = [{ outcome: 'win', entry: 100, stop: 99, rGross: 1.5 },
                { outcome: 'loss', entry: 100, stop: 99, rGross: -1 },
                { outcome: 'loss (both-touch)', entry: 100, stop: 99, rGross: -1 },
                { outcome: 'unfilled', entry: 100, stop: 99, rGross: 0 }];
  const lo = book(rows, 'lower', 'rGross'), up = book(rows, 'upper', 'rGross');
  ok(lo.length === 3 && up.length === 3, 'unfilled rows are not trades and are dropped at both ends');
  ok(lo[2] !== undefined, 'the both-touch row survives');
  const loBt = lo.find(r => r.gross === -1 && r.net < -1);
  ok(lo.filter(r => r.gross === -1).length === 2, 'at the lower bound both-touch is a loss, like the plain loss beside it');
  ok(up.filter(r => r.gross === 1).length === 1, 'at the upper bound it is credited as a win');
  ok(lo.filter(r => r.gross === 1.5).length === 1 && up.filter(r => r.gross === 1.5).length === 1,
     'and the ordinary win is untouched by the bound — only the ambiguous row moves');
  ok(lo.every(r => r.net < r.gross), 'net is always below gross: the cost is charged, never rebated');
}

console.log('\n5. the verdict on the real books — and it is a REFUSAL');
{
  /* A SCHEME IDENTICAL TO THE BASELINE MUST NOT "HOLD". Beating flat has to
     mean strictly beating it — with >= , flat ties itself 16/16 and every
     do-nothing scheme is reported as unanimous. */
  {
    const rows = [{ outcome: 'win', entry: 100, stop: 99, rGross: 1.5 },
                  { outcome: 'loss', entry: 100, stop: 99, rGross: -1 },
                  { outcome: 'win', entry: 100, stop: 98, rGross: 1.5 },
                  { outcome: 'loss', entry: 100, stop: 98, rGross: -1 }];
    const byEnd = { lower: book(rows, 'lower', 'rGross'), upper: book(rows, 'upper', 'rGross') };
    const self = judge(byEnd, SCHEMES[0]);
    ok(self.wins === 0,
       'flat judged against itself wins ' + self.wins + ' of ' + self.total
       + ' — a tie is not an improvement');
    ok(!self.unanimous, 'so the baseline can never be reported as holding');
  }

  const rep = run();
  ok(rep['GOLD SCALP'] && rep['OMNIGOLD'], 'both desks are measured');
  ok(rep['GOLD SCALP'].n > 2000 && rep['OMNIGOLD'].n > 8000,
     'on ' + rep['GOLD SCALP'].n + ' and ' + rep['OMNIGOLD'].n + ' settled trades');

  for (const desk of Object.keys(rep)){
    const held = rep[desk].rows.filter(r => r.unanimous);
    ok(held.length === 0, desk + ': NOTHING is unanimous over ' + WINDOWS
       + ' disjoint windows x 2 bounds x gross+net — no sizing rule ships');
    ok(rep[desk].rows.every(r => r.total === WINDOWS * 2 * 2),
       '  each scheme faced all ' + (WINDOWS * 2 * 2) + ' tests');
  }

  /* THE HYPOTHESIS, NAMED AND REFUTED: graded should have beaten cliff. */
  const gs = rep['GOLD SCALP'];
  const bestGraded = Math.max(...gs.rows.filter(r => /ramp|half|sqrt/.test(r.key)).map(r => r.wins));
  const bestCliff = Math.max(...gs.rows.filter(r => /cliff/.test(r.key)).map(r => r.wins));
  ok(bestGraded <= bestCliff,
     'on GOLD SCALP the best GRADED scheme (' + bestGraded + '/16) does not beat the best cliff ('
     + bestCliff + '/16) — sizing is not better than rejecting, which was the hypothesis');

  /* AND THE REASON THE POOLED NUMBER MUST NOT BE READ ALONE */
  const ramp = gs.rows.find(r => r.key === 'ramp050');
  ok(ramp.whole['lower:net'].e > gs.base['lower:net'].e,
     'ramp050 DOES improve the pooled whole-book net (' + gs.base['lower:net'].e.toFixed(4)
     + ' -> ' + ramp.whole['lower:net'].e.toFixed(4) + ')');
  ok(!ramp.unanimous,
     '  and still fails, at ' + ramp.wins + '/16 — the hg-v920 trap, caught rather than shipped');

  /* THE RISK DENOMINATOR, MADE CONCRETE */
  const cliff = gs.rows.find(r => r.key === 'cliff050');
  ok(cliff.riskKept < 0.15,
     'cliff050 posts the best score on GOLD SCALP while keeping only '
     + (100 * cliff.riskKept).toFixed(0) + '% of the risk — it is barely trading');
  ok(gs.rows.every(r => r.riskKept > 0 && r.riskKept <= 1),
     'and no scheme deploys more risk than flat, which none can');
}

console.log('\n6. the refusal is recorded where the next reader will look');
{
  const src = fs.readFileSync(root + 'scripts/stop-width-sizing.mjs', 'utf8');
  ok(/EVERY TEST SO FAR TREATED IT AS A REJECT/.test(src), 'the script states the gap it was written to close');
  ok(/sum\(w_i \* R_i\) \/ sum\(w_i\)/.test(src), 'and the exact quantity it measures');
  /* the sentence wraps across a comment line, so the gap between words may
     contain a newline and a leading asterisk */
  ok(/ALL FOUR disjoint windows[\s*]+at BOTH fill bounds/.test(src),
     'and the bar a scheme has to clear');
  ok(/NOT acted on/.test(src), 'and that anything short of it is not acted on');
  const agents = fs.readFileSync(root + 'AGENTS.md', 'utf8');
  ok(/stop-width-sizing/.test(agents), 'the refusal is in AGENTS.md so it is not silently re-tried');
}

/* an honest sign-off: this line used to read "all green" unconditionally,
   so a file with failures still printed a pass banner under them */
if (process.exitCode) console.error('\n' + passed + ' passed, but this file FAILED — see above');
else console.log('\n' + passed + ' assertions — all green');
