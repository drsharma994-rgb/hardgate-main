/* HARDGATE — a hundred overlapping rows are not a hundred trades.

   Every interval OMNIGOLD prints treated its replay rows as independent
   draws. The walk that produced them publishes 59.4 plans a day on ONE
   instrument, 9.34 per 4h bar, and holds a time-weighted mean of 55
   positions at once with a peak of 109. That is one bet repeated, and a
   Wilson bound built on the row count is narrower than the evidence
   supports.

   It decided real things. hgOgReplayEdgeVerdict is what promotes a
   mechanic to PROVEN EDGE, and before this correction exactly one of the
   54 mechanics cleared its own breakeven at naive 95%. Deflated to the
   measured effective sample, none does.

   Run: node tests/test-omnigold-effective-sample.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const doc = { getElementById: () => null, createElement: () => ({ style: {}, classList: { add(){}, remove(){} } }),
              querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
              body: { appendChild(){} }, addEventListener(){} };
const ctx = { console, Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array,
              JSON, Date, RegExp, document: doc, setTimeout: () => 0, clearTimeout: () => {},
              addEventListener: () => {}, fetch: () => Promise.reject(new Error('no net')),
              localStorage: { getItem: () => null, setItem(){}, removeItem(){} } };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'plans.js', 'hg-plan.js', 'hg-gates.js', 'omnigold.js']){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* optional deps degrade; omnigold must still load */ }
}

/* hgOgWilsonHit looks up hgWilson at call time. It used to live inline in
   index.html and in no module, so this test lifted it out of the page with a
   brace matcher — "a stub would test the stub" — because without it EVERY
   interval here returns null and half these assertions pass vacuously.

   It now lives in fixpack14-core.js, which the loader above already reads, so
   the lift is gone and the real function is simply present. The vacuity guard
   stays: it is the reason any of this is trustworthy. */
if (typeof ctx.hgWilson !== 'function')
  throw new Error('FAIL: hgWilson did not load from fixpack14-core.js — every interval below would be null');
{
  const probe = ctx.hgWilson(20, 30);
  if (!probe || !(probe.lo > 0) || !(probe.hi < 1))
    throw new Error('FAIL: hgWilson loaded but does not compute an interval');
}

console.log('== the deflation itself ==');
{
  const effN = ctx.hgOgEffN;
  ok(typeof effN === 'function', 'hgOgEffN is exported');
  ok(effN(1000, true) < 1000, 'an overlapping sample is deflated');
  ok(effN(1000, false) === 1000, 'a non-overlapping one is not');
  ok(effN(1000) < 1000, 'and overlap is the DEFAULT — the safe direction is wider intervals');
  ok(Math.abs(effN(7670, true) - 7670 * 0.406) < 1, '7,670 replay rows carry ~3,113 trades of information');
  ok(effN(1, true) >= 1, 'a single row never deflates below one observation');
  ok(effN(2, true) >= 1, 'nor does a tiny sample collapse to zero and make the interval degenerate');
  ok(!isFinite(effN(0, true)), 'no sample yields no effective sample, not a fabricated one');
  ok(!isFinite(effN(NaN, true)), 'and neither does a non-number');
}

console.log('\n== the interval widens, and the observed rate does not move ==');
{
  const W = ctx.hgOgWilsonHit;
  const flat = W(300, 1000, 1.959964);
  const over = W(300, 1000, 1.959964, { overlapping: true });
  ok(flat && over, 'both intervals compute');
  ok(over.lo < flat.lo, 'the lower bound drops when overlap is admitted');
  ok(over.hi > flat.hi, 'and the upper bound rises — it is wider, not shifted');
  /* the point estimate is a property of the trades, not of how many of
     them were simultaneous; deflating wins AND n keeps it put */
  const mid = i => (i.lo + i.hi) / 2;
  ok(Math.abs(mid(over) - mid(flat)) < 0.02, 'the centre stays where the record puts it');
  ok(W(300, 1000, 1.959964, { overlapping: false }).lo === flat.lo,
     'and opting out explicitly is the same as not asking');
}

console.log('\n== what it changed: PROVEN EDGE ==');
{
  const E = ctx.HG_OG_REPLAY_EVIDENCE;
  ok(E && E.kinds, 'the replay table loaded');
  let naive = 0, family = 0, seen = 0;
  for (const kind of Object.keys(E.kinds)){
    const ev = ctx.hgOgReplayEvidence(kind);
    if (!ev) continue;
    const vd = ctx.hgOgReplayEdgeVerdict(ev);
    if (!vd) continue;
    seen++;
    if (vd.tier === 'naive') naive++;
    if (vd.tier === 'family') family++;
  }
  ok(seen > 40, seen + ' mechanics get a verdict');
  ok(naive === 0, 'NONE clears its own breakeven at naive 95% — it was 1 before the deflation');
  ok(family === 0, 'and none survives family-wise, as before');
  ok(naive < seen * 0.05, 'which is fewer than chance alone would produce across ' + seen + ' tries');
}

console.log('\n== the bake that produced the ratio ==');
{
  const BAKE = path.join(ROOT, 'scripts', 'omnigold-evidence-bake.mjs');
  ok(fs.existsSync(BAKE), 'the bake script exists');
  const j = JSON.parse(execFileSync(process.execPath, [BAKE, '--json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

  ok(j.concurrency.peak > 50, 'it measures real concurrency — peak ' + j.concurrency.peak + ' open');
  ok(j.concurrency.meanOpen > 20, 'time-weighted mean ' + j.concurrency.meanOpen + ' positions at once');

  const f = j.populations.formed, sq = j.populations.sequential;
  ok(f && sq, 'both populations are reported');
  ok(f.effective.effN < f.n, 'the FORMED population is deflated (' + f.effective.effN + ' of ' + f.n + ')');
  ok(Math.abs(f.effective.effN / f.n - 0.406) < 0.05,
     'and its ratio is the one hgOgEffN ships — ' + (f.effective.effN / f.n).toFixed(3));

  /* the sequential book cannot overlap: the next trade starts after the
     previous one exits. Its effN must equal n, and the guard that caps
     effN at n is what makes that true even when the cluster SE comes out
     tighter than independence by chance. */
  ok(sq.effective.effN === sq.n, 'the SEQUENTIAL book is not deflated — by construction it cannot overlap');
  ok(sq.n < f.n / 10, 'and it is far smaller: ' + sq.n + ' trades against ' + f.n + ' plans formed');
}

console.log('\n== the sequential book is the one a person could take ==');
{
  const j = JSON.parse(execFileSync(process.execPath,
    [path.join(ROOT, 'scripts', 'omnigold-evidence-bake.mjs'), '--json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const t = j.populations.sequentialTickets;
  ok(t && t.n > 0, 'ticket-only, one at a time: ' + t.n + ' trades');
  ok(t.netR_xm > j.populations.formed.netR_xm,
     'it nets better at XM than the firehose (' + t.netR_xm + ' vs ' + j.populations.formed.netR_xm + ')');
  ok(Math.abs(t.effective.tCluster) < 1.96,
     'and it is still not distinguishable from zero — t=' + t.effective.tCluster);

  /* no cohort is invented: a cell with too few trades is absent, not 0 */
  for (const [k, v] of Object.entries(j.sequentialByCell)){
    ok(v.n >= 10, k + ' is reported because it has ' + v.n + ' trades, not zero-filled');
  }
}

console.log('\n' + passed + ' passed, 0 failed');
