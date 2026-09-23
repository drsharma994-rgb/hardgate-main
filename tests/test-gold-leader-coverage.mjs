/**
 * hg-v920 — why the gold desks crown almost nothing, and three refusals.
 *
 * Reported as a fault: GOLD SCALP and OMNIGOLD "only show weak setups". The
 * cause is the edge table's own coverage — 84.5% of formed volume can never
 * lead — and three arguments that the policy is too strict were tested and
 * failed.
 *
 * The third one is why this guard exists. Grade A beat grade B/C among
 * demoted rows at all three 50/60/70 splits, which looked like a clean
 * out-of-sample result. THE SPLITS ARE NESTED. On disjoint windows it fails.
 * This pins the arithmetic, the refusals, and the tool that settled it.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { splitDisjoint, splitNested, compareDisjoint } from '../scripts/disjoint-windows.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, m + ' — got ' + a + ', want ~' + b);

const book = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-goldscalp-results-floor.json'), 'utf8'))
  .trades.filter((t) => typeof t.netR === 'number' && !t.shadow)
  .sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)));
const stopPct = (t) => (typeof t.entry === 'number' && typeof t.stop === 'number' && t.entry > 0)
  ? Math.abs(t.entry - t.stop) / t.entry * 100 : 0;
const grade = (t) => String(t.grade || '').replace('demoted-', '');
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;

/* ---- 1. THE NESTED SPLITS ARE NOT INDEPENDENT ---- */
console.log('1. nested splits share their rows — the flaw this pack fixes');
{
  const nested = splitNested(book, [0.5, 0.6, 0.7]);
  eq(nested.length, 3, 'three nested test sets');
  /* each is a strict subset of the previous one */
  const setOf = (a) => new Set(a.map((t) => t.tISO + '|' + t.stratKey + '|' + t.entry));
  const s50 = setOf(nested[0]), s60 = setOf(nested[1]), s70 = setOf(nested[2]);
  ok(nested[1].every((t) => s50.has(t.tISO + '|' + t.stratKey + '|' + t.entry)),
     'the 60% test set is entirely inside the 50% one');
  ok(nested[2].every((t) => s60.has(t.tISO + '|' + t.stratKey + '|' + t.entry)),
     'and the 70% set is entirely inside the 60%');
  ok(s70.size < s60.size && s60.size < s50.size, 'so they nest rather than partition');
  /* disjoint windows share nothing */
  const w = splitDisjoint(book, 4);
  eq(w.length, 4, 'four disjoint windows');
  eq(w.reduce((a, s) => a + s.length, 0), book.length, 'they partition the book exactly');
  const seen = new Set();
  let overlap = 0;
  for (const seg of w) for (const t of seg){
    const k = t.tISO + '|' + t.stratKey + '|' + t.entry;
    if (seen.has(k)) overlap++; else seen.add(k);
  }
  eq(overlap, 0, 'and no row appears in two of them');
}

/* ---- 1b. compareDisjoint's contract, on fixtures ---- */
console.log('1b. the comparator itself');
{
  /* a window thinner than the floor must be reported thin and NOT judged —
     the real book has four thick windows, so this path needs a fixture or it
     ships untested. */
  const rows = [];
  for (let i = 0; i < 100; i++) rows.push({ tISO: 'T' + String(i).padStart(3, '0'), g: 'A', v: 1 });
  for (let i = 0; i < 100; i++) rows.push({ tISO: 'U' + String(i).padStart(3, '0'), g: 'B', v: 0 });
  rows.sort((a, b) => a.tISO.localeCompare(b.tISO));
  /* two windows: the first is all A, the second all B — neither has 20 of both */
  const thin = compareDisjoint(rows, 2, (t) => t.g === 'A', (t) => t.g === 'B', (t) => t.v);
  eq(thin.judged, 0, 'a window missing one cohort is not judged');
  ok(thin.windows.every((w) => w.thin), 'both windows report thin');
  eq(thin.unanimous, false, 'and nothing is called unanimous on zero judged windows');
  eq(thin.aBetter, 0, 'no window is counted as a win');

  /* mixed windows, A always ahead by exactly 1 -> unanimous */
  const mixed = [];
  for (let i = 0; i < 200; i++)
    mixed.push({ tISO: 'T' + String(i).padStart(3, '0'), g: i % 2 ? 'A' : 'B', v: i % 2 ? 1 : 0 });
  const uni = compareDisjoint(mixed, 4, (t) => t.g === 'A', (t) => t.g === 'B', (t) => t.v);
  eq(uni.judged, 4, 'four thick windows are judged');
  eq(uni.aBetter, 4, 'A is ahead in all four');
  eq(uni.unanimous, true, 'so the claim is unanimous');
  for (const w of uni.windows) near(w.diff, 1, 1e-12, 'each window measures the +1 gap exactly');

  /* the t statistic must use BOTH cohorts' standard errors. Give A a wide
     spread and B none: dropping B's term barely moves t, but dropping A's
     would explode it — so check t against the two-sample formula directly. */
  const spread = [];
  for (let i = 0; i < 120; i++){
    spread.push({ tISO: 'T' + String(i).padStart(3, '0'), g: 'A', v: (i % 2 ? 10 : -10) + 1 });
    spread.push({ tISO: 'T' + String(i).padStart(3, '0') + 'b', g: 'B', v: (i % 3 ? 4 : -4) });
  }
  spread.sort((a, b) => a.tISO.localeCompare(b.tISO));
  const r2 = compareDisjoint(spread, 2, (t) => t.g === 'A', (t) => t.g === 'B', (t) => t.v);
  for (const w of r2.windows){
    if (w.thin) continue;
    const seg = null;  /* recompute from the window's own reported pieces */
    ok(isFinite(w.t), 'the window reports a finite t');
  }
  {
    /* recompute one window's t independently and require a match */
    const segs = splitDisjoint(spread, 2);
    const seg = segs[0];
    const A = seg.filter((t) => t.g === 'A').map((t) => t.v);
    const B = seg.filter((t) => t.g === 'B').map((t) => t.v);
    const mn = (v) => v.reduce((a, b) => a + b, 0) / v.length;
    const sd = (v) => Math.sqrt(v.reduce((a, x) => a + (x - mn(v)) ** 2, 0) / (v.length - 1));
    const seA = sd(A) / Math.sqrt(A.length), seB = sd(B) / Math.sqrt(B.length);
    const want = (mn(A) - mn(B)) / Math.sqrt(seA * seA + seB * seB);
    near(r2.windows[0].t, want, 1e-9, 't is the two-sample statistic, using BOTH standard errors');
    ok(Math.abs(r2.windows[0].t - (mn(A) - mn(B)) / seA) > 1e-6,
       'and is NOT the one-sample version that ignores the second cohort');
  }
}

/* ---- 2. the grade-A claim: passes nested, fails disjoint ---- */
console.log('2. the claim that nearly shipped');
{
  const demotedToday = book.filter((t) => stopPct(t) >= 0.16 && t.demoted);
  const isA = (t) => grade(t) === 'A';
  const isBC = (t) => grade(t) === 'B' || grade(t) === 'C';
  /* nested: A wins every time */
  let nestedWins = 0;
  for (const f of [0.5, 0.6, 0.7]){
    const oos = demotedToday.slice(Math.floor(demotedToday.length * f));
    const A = oos.filter(isA).map((t) => t.netR), B = oos.filter(isBC).map((t) => t.netR);
    if (A.length >= 20 && B.length >= 20 && mean(A) > mean(B)) nestedWins++;
  }
  eq(nestedWins, 3, 'grade A wins at all three NESTED splits — which is what made it look real');
  /* disjoint: it does not */
  const res = compareDisjoint(demotedToday, 4, isA, isBC, (t) => t.netR);
  eq(res.judged, 4, 'all four disjoint windows are thick enough to judge');
  eq(res.aBetter, 1, 'grade A is better in only ONE of the four');
  eq(res.bBetter, 3, 'and worse in three');
  eq(res.unanimous, false, 'so the claim does not hold and nothing may be built on it');
  /* the one window it wins is the one every nested set contained */
  const winner = res.windows.findIndex((w) => !w.thin && w.diff > 0);
  eq(winner, 3, 'and the window it wins is the LAST one — the one all three nested sets share');
  /* the worst window is significantly against it */
  ok(res.windows[0].t < -1.96, 'the first window is significantly AGAINST grade A (t=' + res.windows[0].t.toFixed(2) + ')');
  /* pooled on today's population, A is significantly worse */
  const A = demotedToday.filter(isA).map((t) => t.netR);
  const B = demotedToday.filter(isBC).map((t) => t.netR);
  ok(mean(A) < mean(B), 'pooled on the population the desk forms today, grade A is WORSE');
  near(mean(A), -0.0816, 0.002, 'grade A pools at -0.082R');
  near(mean(B), 0.0071, 0.002, 'grade B/C at +0.007R');
}

/* ---- 3. the coverage arithmetic the desks now state ---- */
console.log('3. the coverage arithmetic');
{
  const goldind = readFileSync(join(ROOT, 'goldind.js'), 'utf8');
  const blk = goldind.slice(goldind.indexOf('var HG_GOLD_SETUP_EDGE'));
  const scalp = blk.slice(0, blk.indexOf('  swing:'));
  const actions = {};
  /* hg-v928: a hand-tuned row carries BOTH verdicts. Parse each so the pack's
     headline — how much formed volume the retune freed to lead — is asserted
     rather than silently overwritten. */
  const baked = {};
  for (const m of scalp.matchAll(/^ {4}(\w+):\s+\{ n: [^\n]*?action: '(\w+)'(?:, actionBaked: '(\w+)')?/gm)){
    actions[m[1]] = m[2]; baked[m[1]] = m[3] || m[2];
  }
  ok(Object.keys(actions).length >= 25, 'parsed the scalp edge table (' + Object.keys(actions).length + ' rows)');
  const all = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-goldscalp-results-floor.json'), 'utf8'))
    .trades.filter((t) => !t.shadow);
  const by = {};
  for (const t of all) by[actions[t.stratKey] || 'none'] = (by[actions[t.stratKey] || 'none'] || 0) + 1;
  const pc = (k) => (by[k] || 0) / all.length * 100;
  /* the BAKED verdicts still give hg-v920's arithmetic, unchanged */
  const byB = {};
  for (const t of all) byB[baked[t.stratKey] || 'none'] = (byB[baked[t.stratKey] || 'none'] || 0) + 1;
  const pcB = (k) => (byB[k] || 0) / all.length * 100;
  near(pcB('demote'), 62.9, 0.15, 'on the BAKED verdicts demote is still 62.9% of formed volume');
  near(pcB('suppress'), 21.6, 0.15, 'and suppress still 21.6%');
  near(pcB('demote') + pcB('suppress'), 84.5, 0.2, 'so 84.5% could never lead before the retune');
  /* and the retune is what moved them — the headline of hg-v928 */
  near(pc('demote'), 59.2, 0.15, 'demote is 59.2% of formed volume');
  near(pc('suppress'), 10.1, 0.15, 'suppress is 10.1%');
  near(pc('demote') + pc('suppress'), 69.3, 0.2, 'so 69.3% can never lead');
  /* THE HEADLINE OF hg-v928, asserted as a delta so it cannot be read as a
     re-measurement: four verdicts moving on instruction freed 15.2 points of
     formed volume to lead. Nothing was re-walked. */
  near((pcB('demote') + pcB('suppress')) - (pc('demote') + pc('suppress')), 15.2, 0.3,
       'the retune freed 15.2 points of formed volume to lead');
  /* the six highest-volume detectors are all blocked */
  const counts = {};
  for (const t of all) counts[t.stratKey] = (counts[t.stratKey] || 0) + 1;
  const top6 = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
  /* hg-v920 measured that ALL SIX highest-volume detectors were blocked. The
     hg-v928 retune freed two of them (bosalign, ribbon), so the claim splits:
     all six are still blocked in the BAKE, and four remain blocked in force. */
  for (const k of top6)
    ok(baked[k] === 'demote' || baked[k] === 'suppress',
       'the high-volume detector ' + k + ' is ' + baked[k] + ' in the bake');
  const freed = top6.filter((k) => actions[k] !== 'demote' && actions[k] !== 'suppress');
  eq(freed.sort().join(','), 'bosalign,ribbon',
     'and exactly two of the six were freed by the retune');
  /* MOST PROBABLE fires once in 51 scans */
  const meta = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-goldscalp-results-floor.json'), 'utf8')).meta;
  const mp = book.filter((t) => t.mp).length;
  eq(mp, 111, 'MOST PROBABLE fired 111 times');
  near(meta.counters.scans / mp, 51, 1, 'over ' + meta.counters.scans + ' scans — once in 51');
  /* and the desk says so, where the absence is seen */
  const gs = readFileSync(join(ROOT, 'goldscalp.js'), 'utf8');
  /* Assert the RENDERED line, not the file. Every one of these figures also
     appears in the comment above it, so a substring check over goldscalp.js
     passes while the visible text says something else — the hg-v916 and
     hg-v919 survivor, a third time. Extract the function's own string
     literals and check those. */
  const fnAt = gs.indexOf('function goldCoverageNoteHTML');
  ok(fnAt > 0, 'goldCoverageNoteHTML exists');
  const fnEnd = gs.indexOf('\nfunction ', fnAt + 10);
  const body = gs.slice(fnAt, fnEnd > 0 ? fnEnd : fnAt + 2000);
  const rendered = [...body.matchAll(/'([^']*)'/g)].map((m) => m[1]).join('');
  ok(/WHY SO FEW LEADERS/.test(rendered), 'the rendered line states it');
  for (const n of ['84.5%', '62.9%', '21.6%', 'once in 51 scans'])
    ok(rendered.includes(n), 'the RENDERED line carries ' + n);
  /* and those shares must be the measured ones */
  near(pc('demote'), Number((rendered.match(/(\d+\.\d)% is demoted/) || [])[1]), 0.15,
     'the rendered demote share matches the replay');
  near(pc('suppress'), Number((rendered.match(/(\d+\.\d)% is suppressed/) || [])[1]), 0.15,
     'the rendered suppress share matches the replay');
  near(pc('demote') + pc('suppress'),
     Number((rendered.match(/(\d+\.\d)%<\/b> of what this desk forms/) || [])[1]), 0.2,
     'and the headline share is their sum');
  ok(/quiet board is that policy working, not a fault/.test(rendered),
     'the line says a quiet board is the policy working');
  ok(!/broken/i.test(rendered), 'and never calls the desk broken');
  ok(/none survived out of sample/.test(rendered), 'and that no argument to loosen it survived');
  /* it must actually be attached to the panel the reader meets */
  const wsAt = gs.indexOf('function whySilentHTML');
  const wsBody = gs.slice(wsAt, gs.indexOf('\nfunction ', wsAt + 10));
  ok(/goldCoverageNoteHTML\(\)/.test(wsBody),
     'and WHY SILENT appends it, so the silence and its cause arrive together');
  /* the two denominators must not be added together again */
  ok(/TWO DENOMINATORS, KEPT APART/.test(gs), 'the first draft added them and the fix is recorded');
  ok(!/94\.1%.*62\.9%.*\+.*21\.6%/.test(gs), 'the garbled sum is gone from the rendered line');
}

/* ---- 4. all three refusals are written down ---- */
console.log('4. the three refusals');
{
  const g = readFileSync(join(ROOT, 'goldind.js'), 'utf8').replace(/\s+/g, ' ');
  ok(/The rows it crowns do worse than the rows it passes over/.test(g), 'refusal 1 is recorded');
  ok(/BREAKS at every out-of-sample split/.test(g), 'with why it failed');
  ok(/Tally separates outcomes inside a demoted mechanic/.test(g), 'refusal 2 is recorded');
  ok(/THE SPLITS ARE NESTED/.test(g), 'refusal 3 names the flaw that produced it');
  ok(/hg-v699 already removed a fallback of this shape after measuring it at -1\.49R/.test(g),
     'and the precedent that a fallback of this shape was already tried');
  ok(/Nothing is unblocked/.test(g), 'and that nothing was loosened');
  /* the earlier packs re-checked */
  ok(/hg-v914, v915, v916 and v918/.test(g), 'the packs that used nested splits are named');
  ok(/every one of those refusals still stands/.test(g),
     'and re-checked on disjoint windows — the flaw was latent, not load-bearing');
}
{
  /* re-run that re-check here, so the claim is verified rather than asserted */
  const SUP = ['vwap', 'nyexh', 'liqsweep', 'sweep'];
  const formed = book.filter((t) => stopPct(t) >= 0.16 && !SUP.includes(t.stratKey));
  for (const k of ['bosalign', 'ribbon']){
    const r = compareDisjoint(formed, 4, (t) => t.stratKey === k, (t) => t.stratKey !== k, (t) => t.netR, 15);
    ok(!r.unanimous, k + ' is not unanimous on disjoint windows either, so its hg-v916 demote stands');
  }
}

/* ---- 5. the tier the scan cannot reach ---- */
console.log('5. the unreachable tier');
{
  const og = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-omnigold-results.json'), 'utf8')).trades;
  const scored = og.map((t) => t.confluence).filter((x) => typeof x === 'number');
  ok(scored.length > 9000, 'the OMNIGOLD replay scored ' + scored.length + ' rows');
  eq(scored.filter((x) => x >= 85).length, 0, 'and NOT ONE reached the 85 the top tier needs');
  const max = Math.max(...scored);
  ok(max < 85, 'the scan score tops out at ' + max);
  eq(max, 78, 'which is 78');
  const o = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
  ok(/SCAN CARDS NEVER REACH THIS/.test(o), 'the legend cell says the scan cannot reach it');
  ok(o.includes('tops out near 78') && o.includes('0 of 9,897'), 'with the measured numbers');
  /* scope to the capA assignment — the phrase also sits in a comment, and a
     file-wide check passes while the rendered caption loses it (the same twin
     problem as the shares above) */
  const capAt = o.indexOf('var capA =');
  ok(capAt > 0, 'the top-tier caption is built at var capA');
  const capBody = o.slice(capAt, o.indexOf(';', o.indexOf('SCAN CARDS NEVER REACH THIS')) + 1);
  /* BOTH branches — with a replay record and without. Checking only that the
     phrase appears somewhere in the caption passes when the with-record branch
     loses it and the fallback keeps it, which is the branch a reader with data
     never sees. */
  eq((capBody.match(/engine grade-A scalar only/g) || []).length, 2,
     'both caption branches keep the path that CAN reach the tier');
  ok(/SCAN CARDS NEVER REACH THIS/.test(capBody), 'and carries the scan-path fact');
  ok(capBody.includes('78') && capBody.includes('9,897'), 'with both measured numbers');
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : '') + pass + ' assertions passed');
if (fail) process.exit(1);
