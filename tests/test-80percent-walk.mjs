/* HARDGATE — the 5m walk that decides whether 80PERCENT's 85% is real.

   This is a backtest ENGINE. If its resolver is wrong then every number it
   produces is wrong in a way nobody will notice, because a backtest never
   fails loudly — it just returns a plausible figure. So the resolver is
   checked against bars constructed so that the right answer is known before
   the code runs.

   THE FOUR THINGS IT HAS TO GET RIGHT, and why each one matters more here
   than on a normal strategy:

     AMBIGUITY. Target is 0.75 ATR away and the stop 4.00 ATR, so a single
     bar whose range covers both cannot be ordered from OHLC. Guess it wrong
     and you have mispriced 5.33 winners with one row. These are flagged, not
     guessed, and flow through lib/unprovable-fill.mjs as an INTERVAL.

     GAPS. A bar that OPENS through the stop fills at that open, not at the
     stop, so the loss is WORSE than -1R. Modelling every stop as exactly -1R
     is what makes a 4 ATR stop look safe — the exact failure the spec's own
     risk warning describes. A gap is unambiguous (the open is the first
     print) and must be priced there, both ways.

     SEQUENCE. Signals fire on consecutive bars in a trend. Taking all of
     them is a record nobody could have traded.

     COST. A 0.75 ATR target on 5m gold is a couple of dollars against a
     spread that is most of one. Gross is not the number that decides.

   And one thing it must NOT do: reimplement the strategy. The walk loads
   eightypercent.js and calls its own hg80Scan, so what is measured is what
   the tab shows.

   Run: node tests/test-80percent-walk.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve, summarise, wilson, loadStrategy, run, conditionCensus } from '../scripts/walk-80percent.mjs';
import { winRateBounds, thresholdVsInterval } from '../lib/unprovable-fill.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);

/* A long from 100: target 102 (+2), stop 92 (-8). risk 8, so +2 is +0.25R. */
const PLAN = { dir: 'long', entry: 100, t1: 102, stop: 92 };
const bar = (t, o, h, l, c) => ({ t, o, h, l, c, v: 1 });
/* index 0 is the signal bar; resolution starts at index 1 */
const withBars = (...rest) => [bar(0, 100, 100, 100, 100), ...rest];

console.log('== a clean win and a clean loss ==');
{
  const win = resolve(withBars(bar(300, 100, 102.5, 99, 102)), 0, PLAN, 50);
  ok(win.outcome === 'win', 'a bar whose high reaches the target is a win');
  ok(near(win.exit, 102), 'filled AT the target, not at the high');
  ok(near(win.rMultiple, 0.25), 'worth +0.25R — 0.75 ATR against a 4.00 ATR risk');
  ok(win.ambiguous === false && win.gapped === false, 'unambiguous and ungapped');
  ok(win.bars === 1, 'resolved on the first bar after the signal');

  const loss = resolve(withBars(bar(300, 100, 100.5, 91.5, 93)), 0, PLAN, 50);
  ok(loss.outcome === 'loss', 'a bar whose low reaches the stop is a loss');
  ok(near(loss.exit, 92), 'filled AT the stop');
  ok(near(loss.rMultiple, -1), 'worth exactly -1R');
  ok(loss.ambiguous === false, 'and unambiguous — only one level was inside the bar');
}

console.log('\n== resolution starts on the bar AFTER the signal ==');
{
  /* entry is the signal bar's close, so that bar cannot also resolve it —
     the position did not exist for the part of the bar before its close */
  const r = resolve([bar(0, 90, 103, 90, 100), bar(300, 100, 100.2, 99.8, 100)], 0, PLAN, 50);
  ok(r.outcome === 'expired' || r.bars >= 1,
     'the signal bar\'s own range cannot resolve the trade it created');
  ok(r.bars !== 0, 'never settled on bar zero');
}

console.log('\n== both levels in one bar is AMBIGUOUS, never a silent win ==');
{
  /* range 91..103 covers the target AND the stop; OHLC cannot order them */
  const amb = resolve(withBars(bar(300, 100, 103, 91, 95)), 0, PLAN, 50);
  ok(amb.ambiguous === true, 'the row is flagged ambiguous');
  ok(amb.outcome === 'win', 'scored optimistically as the target...');
  ok(near(amb.rMultiple, 0.25), '...at the target price');

  /* THE POINT OF THE FLAG: it must be strippable at the lower bound */
  const rows = [
    { outcome: 'win',  unprovableFill: true },   /* the ambiguous one */
    { outcome: 'win',  unprovableFill: false },
    { outcome: 'loss', unprovableFill: false }
  ];
  const b = winRateBounds(rows);
  ok(near(b.upper, 2 / 3), 'at the UPPER bound the ambiguous win counts: 2 of 3');
  ok(near(b.lower, 1 / 2), 'at the LOWER bound it is dropped entirely: 1 of 2');
  ok(b.lower < b.upper, 'so an ambiguous bar widens the interval instead of deciding it');
  ok(b.unprovable === 1, 'and the count of ambiguous rows is reported');
}

console.log('\n== a gap fills at the open, and costs more than the stop ==');
{
  /* opens at 89, already through the 92 stop: the fill is 89, not 92 */
  const gap = resolve(withBars(bar(300, 89, 90, 88, 88.5)), 0, PLAN, 50);
  ok(gap.outcome === 'loss', 'a gap through the stop is a loss');
  ok(gap.gapped === true, 'flagged as gapped');
  ok(near(gap.exit, 89), 'filled at the OPEN, not at the stop');
  ok(near(gap.rMultiple, -11 / 8), `worth ${gap.rMultiple.toFixed(4)}R — WORSE than -1R`);
  ok(gap.rMultiple < -1,
     'which is the whole point: a 4 ATR stop does not cap the loss at 4 ATR');
  ok(gap.ambiguous === false, 'and a gap is unambiguous — the open is the first print');

  /* favourable gaps are priced the same way, or the model flatters one side */
  const gapUp = resolve(withBars(bar(300, 104, 105, 103.5, 104.5)), 0, PLAN, 50);
  ok(gapUp.outcome === 'win' && gapUp.gapped === true, 'a gap through the target is a gapped win');
  ok(near(gapUp.exit, 104), 'filled at the open');
  ok(gapUp.rMultiple > 0.25, `worth ${gapUp.rMultiple.toFixed(4)}R — BETTER than the target`);

  /* a gap past the stop takes precedence over a high that also reached the
     target later in the same bar: the open happened first */
  const gapThenHigh = resolve(withBars(bar(300, 89, 103, 88, 102)), 0, PLAN, 50);
  ok(gapThenHigh.outcome === 'loss' && gapThenHigh.gapped === true,
     'a bar that opens through the stop is a loss even if it later prints the target');
  ok(gapThenHigh.ambiguous === false,
     'and is NOT ambiguous — the open orders it, which is exactly what OHLC can establish');
}

console.log('\n== a short is the mirror of all of it ==');
{
  const S = { dir: 'short', entry: 100, t1: 98, stop: 108 };
  const win = resolve(withBars(bar(300, 100, 100.5, 97.5, 98)), 0, S, 50);
  ok(win.outcome === 'win' && near(win.exit, 98) && near(win.rMultiple, 0.25),
     'a short wins when the low reaches its target, at +0.25R');
  const loss = resolve(withBars(bar(300, 100, 108.5, 99.5, 108)), 0, S, 50);
  ok(loss.outcome === 'loss' && near(loss.rMultiple, -1), 'and loses at -1R on its stop');
  const gap = resolve(withBars(bar(300, 111, 112, 110, 111)), 0, S, 50);
  ok(gap.gapped === true && gap.rMultiple < -1, 'a gap above the stop is worse than -1R');
  const amb = resolve(withBars(bar(300, 100, 109, 97, 105)), 0, S, 50);
  ok(amb.ambiguous === true, 'and a bar covering both levels is ambiguous on the short side too');
}

console.log('\n== the horizon expires, and an expiry is not an outcome ==');
{
  const flat = [bar(0, 100, 100, 100, 100)];
  for (let i = 1; i <= 20; i++) flat.push(bar(i * 300, 100, 100.4, 99.6, 100));
  const r = resolve(flat, 0, PLAN, 10);
  ok(r.outcome === 'expired', 'a trade that touches neither level expires');
  ok(r.bars === 10, 'at the horizon, not later');
  ok(isFinite(r.rMultiple), 'carrying its mark-to-market R');

  /* and an expiry must NOT be counted as a win or a loss anywhere */
  const s = summarise([
    { outcome: 'win', rMultiple: 0.25, netR_XM: 0.2, netR_PAXG: -0.6, riskPx: 8 },
    { outcome: 'loss', rMultiple: -1, netR_XM: -1.05, netR_PAXG: -1.9, riskPx: 8 },
    { outcome: 'expired', rMultiple: 0.02, netR_XM: 0, netR_PAXG: -0.8, riskPx: 8 }
  ]);
  ok(s.settled === 2, 'the summary settles only the win and the loss');
  ok(s.expired === 1, 'and reports the expiry separately');
  ok(s.byBound.point.n === 2, 'no bound counts the expiry');
}

console.log('\n== the breakeven it is measured against is the spec\'s own ==');
{
  const s = summarise([{ outcome: 'win', rMultiple: 0.25, netR_XM: 0.2, netR_PAXG: -0.6 }]);
  ok(near(s.grossBreakeven, 4 / 4.75, 1e-12),
     `the bar is 4.00/(4.00+0.75) = ${(100 * s.grossBreakeven).toFixed(4)}%`);
  ok(s.grossBreakeven > 0.84 && s.grossBreakeven < 0.843, 'which is 84.21%, not 80 and not 85');
}

console.log('\n== the verdict survives BOTH uncertainties, not just one ==');
{
  const mk = (outcome, amb) => ({ outcome, unprovableFill: !!amb,
    rMultiple: outcome === 'win' ? 0.25 : -1, netR_XM: 0, netR_PAXG: -1 });

  /* THE TRAP THIS PINS. thresholdVsInterval compares only the AMBIGUITY
     bounds — it has no notion of sample size. On nine wins and one loss,
     with nothing ambiguous, lower == upper == 90% and it reports 'below',
     meaning established above the bar. On ten trades that is nonsense, and
     an earlier draft of this walk shipped it as the verdict. */
  const thin = [];
  for (let i = 0; i < 9; i++) thin.push(mk('win'));
  thin.push(mk('loss'));
  ok(thresholdVsInterval(thin, 4 / 4.75) === 'below',
     'ambiguity alone calls 9-of-10 an established edge — which is why it is not the verdict');
  const thinV = summarise(thin).verdict;
  ok(thinV.state === 'not-established',
     'the real verdict says NOT ESTABLISHED on ten trades');
  ok(thinV.worstCaseLo < 4 / 4.75,
     `because the worst-case lower limit is ${(100 * thinV.worstCaseLo).toFixed(1)}%, under the bar`);

  /* enough clean trades and it does become established */
  const fat = [];
  for (let i = 0; i < 950; i++) fat.push(mk('win'));
  for (let i = 0; i < 50; i++) fat.push(mk('loss'));
  const fatV = summarise(fat).verdict;
  ok(fatV.state === 'established-above',
     '95% on a thousand trades IS established above the bar');
  ok(fatV.worstCaseLo > 4 / 4.75, 'its worst case clears 84.21%');

  /* ...and ambiguity can take it away, but only when the rate sits near the
     bar. At 95% the lower bound is still 91.67% and clears comfortably —
     ambiguity is not a magic doubt-maker, it bites when the margin is thin,
     which is precisely this strategy's situation. */
  const strong = [];
  for (let i = 0; i < 950; i++) strong.push(mk('win', i < 400));
  for (let i = 0; i < 50; i++) strong.push(mk('loss'));
  ok(summarise(strong).verdict.state === 'established-above',
     '400 ambiguous bars do NOT unseat a 95% rate — its lower bound is still 91.67%');

  /* 88%, which is above the bar but not by much — here ambiguity decides */
  const murky = [];
  for (let i = 0; i < 880; i++) murky.push(mk('win', i < 300));
  for (let i = 0; i < 120; i++) murky.push(mk('loss'));
  const murkyV = summarise(murky).verdict;
  ok(murkyV.state === 'not-established',
     '88% with 300 ambiguous bars establishes nothing — the margin was too thin to survive them');
  ok(murkyV.worstCaseLo < 4 / 4.75,
     `its worst case falls to ${(100 * murkyV.worstCaseLo).toFixed(1)}%, under the bar`);
  ok(murkyV.bestCaseHi > 4 / 4.75, 'while its best case is still above — hence "not established"');
  ok(murkyV.worstCaseLo < fatV.worstCaseLo,
     'and stripping ambiguous wins at the lower bound is what drops it');

  /* and a genuinely bad strategy is established BELOW, not merely unproven */
  const bad = [];
  for (let i = 0; i < 500; i++) bad.push(mk('win'));
  for (let i = 0; i < 500; i++) bad.push(mk('loss'));
  ok(summarise(bad).verdict.state === 'established-below',
     '50% on a thousand trades is established BELOW the bar — the walk can condemn, not only fail to bless');
}

console.log('\n== and the verdict is not the same question as "does it pay" ==');
{
  /* a win rate can clear the gross bar while net R is still negative — the
     entire point of a 0.75 ATR target priced against a fixed spread */
  const rows = [];
  for (let i = 0; i < 900; i++) rows.push({ outcome: 'win', unprovableFill: false,
    rMultiple: 0.25, netR_XM: 0.18, netR_PAXG: -0.60 });
  for (let i = 0; i < 100; i++) rows.push({ outcome: 'loss', unprovableFill: false,
    rMultiple: -1, netR_XM: -1.07, netR_PAXG: -1.90 });
  const s = summarise(rows);
  ok(s.verdict.state === 'established-above', '90% on a thousand clears the gross bar');
  ok(s.paysAtVenue.XM.positiveAtEveryBound === true, 'and pays at XM');
  ok(s.paysAtVenue.PAXG.positiveAtEveryBound === false,
     'while LOSING at PAXG on the identical trades — the win rate was never the whole question');
  ok(s.paysAtVenue.PAXG.point < 0, 'net R at PAXG is negative at the point estimate');
}

console.log('\n== cost is applied per trade, at both venues ==');
{
  const ctx = loadStrategy();
  ok(typeof ctx.hg80Scan === 'function', 'the walk loads the TAB\'s strategy, not a copy');
  ok(ctx.HG_P80_SPEC.tpAtr === 0.75 && ctx.HG_P80_SPEC.slAtr === 4.00,
     'and gets the spec straight from it, so the two cannot drift');

  const SRC = fs.readFileSync(path.join(ROOT, 'scripts/walk-80percent.mjs'), 'utf8');
  ok(/eightypercent\.js/.test(SRC), 'by loading the tab file by name');
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/RSI_LONG|rsi\s*<\s*45|0\.75\s*\*/.test(code),
     'and re-derives none of the entry or exit rules itself');

  ok(/XM: 0\.00020/.test(SRC) && /PAXG: 0\.0026/.test(SRC),
     'both venue round trips are the desk\'s own');
  ok(/costR_.*entry \* rt\) \/ row\.riskPx/.test(SRC.replace(/\n/g, ' ')),
     'cost is charged as a fraction of the trade\'s own risk, per trade');
}

console.log('\n== the walk explains its own trade count ==');
{
  /* A walk that returns three trades looks like a bug or a data problem.
     Here it is neither: for a LONG the spec wants price ABOVE its 50 EMA
     while RSI(14) says the last fourteen bars were net DOWN, and those two
     fight each other. The census measures that instead of leaving the user
     to guess, on whatever bars they run it against. */
  let s = 11;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rows = []; let px = 4300;
  const base = Date.UTC(2026, 6, 1) / 1000;
  for (let i = 0; i < 6000; i++){
    const d = Math.sin(i / 700) * 0.6, sh = (rnd() - 0.5) * 3.0;
    const o = px, c = px + d + sh, w = 0.5 + rnd() * 1.6;
    rows.push({ t: base + i * 300, o, h: Math.max(o, c) + w, l: Math.min(o, c) - w, c, v: 100 });
    px = c;
  }
  const ctx = loadStrategy();
  const cs = conditionCensus(rows, ctx);
  ok(!!cs && cs.evaluable > 5000, 'the census evaluates the series');
  ok(cs.session > 0 && cs.session < cs.evaluable,
     'and counts the session bars as a strict subset — the window really filters');

  for (const k of ['long', 'short']){
    const x = cs[k];
    ok(x.pTrend > 0.2 && x.pTrend < 0.9, k + ': the trend condition alone is common');
    ok(x.pPullback > 0.2 && x.pPullback < 0.9, k + ': the pullback condition alone is common');
    ok(x.pTrendPull < x.pTrend && x.pTrendPull < x.pPullback,
       k + ': but together they are rarer than either');
    ok(x.pTrendPull < x.pIfIndependent,
       k + ': and rarer than independence predicts — they are anti-correlated, not unrelated');
    ok(x.rarerThanIndependent > 2,
       k + `: by ${x.rarerThanIndependent.toFixed(1)}x, which is what explains the trade count`);
  }

  /* the census must be reported, not just computed */
  const SRC = fs.readFileSync(path.join(ROOT, 'scripts/walk-80percent.mjs'), 'utf8');
  ok(/conditions: census/.test(SRC), 'the artifact carries the census');
  ok(/WHY THE TRADE COUNT IS WHAT IT IS/.test(SRC), 'and the console explains it');
  ok(/not a bug, and not a data problem/.test(SRC), 'saying so in as many words');
}

console.log('\n== sequencing: one position at a time ==');
{
  const SRC = fs.readFileSync(path.join(ROOT, 'scripts/walk-80percent.mjs'), 'utf8');
  ok(/openUntil/.test(SRC), 'the book tracks when the current position closes');
  ok(/s\.i <= openUntil/.test(SRC), 'and skips any signal that fires while it is open');
  ok(/skippedWhileInPosition/.test(SRC), 'reporting how many were skipped, not hiding them');
}

console.log('\n== it refuses to run rather than run on nothing ==');
{
  const SRC = fs.readFileSync(path.join(ROOT, 'scripts/walk-80percent.mjs'), 'utf8');
  ok(/blocked: blocked \? 'network' : 'fetch'/.test(SRC),
     'a blocked host is reported as a network block, distinct from a failed fetch');
  ok(/will not clear on a retry/.test(SRC), 'and a policy denial is named as one');
  ok(/need at least 600/.test(SRC), 'too few bars refuses rather than producing a thin number');
  ok(/EMA\(200\) alone needs 200 bars/.test(SRC), 'saying why 600 is the floor');
  ok(/process\.exit\(1\)/.test(SRC), 'exiting non-zero so a pipeline cannot mistake it for a run');
}

console.log('\n' + passed + ' passed, 0 failed');
