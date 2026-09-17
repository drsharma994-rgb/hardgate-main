/* HARDGATE — four detectors emit a long label and a short label, and the
   two halves do not agree.

   WHAT WAS FOUND, AND HOW FAR IT GOES

   hgOmniSpring returns 'SPRING' on a swept low and 'UTAD' on a swept high.
   hgOgPdSweep returns PDL / PDH-SWEEP. The EQ sweep in hg-mechanics.js
   returns EQL / EQH-SWEEP. hgOgPwSweep returns PWL / PWH-SWEEP. One
   function each, one label per side, and in the walk every firing of a
   label sits on one side: SPRING 123/123 long, UTAD 106/106 short.

   Across the unprovable-fill interval the SHORT half is the better half in
   all four pairs, at all three bounds — 12 of 12 comparisons, none
   reversing. That is the only formation cut measured on this walk whose
   sign survives the interval. Order type, stop distance and session all
   flip: BUY_LIMIT runs -8.17σ at the lower bound and +2.70σ at the upper.

   AND IT IS NOT ESTABLISHED. Corrected for overlap (effN/n = 0.406) no
   individual pair reaches ±1.9 at any bound, and the four combined by
   Stouffer peak at -2.15 against a family-wise bar of 2.234 for four tests.
   It is in-sample, on four detectors sharing one instrument and overlapping
   bars, so even that combined figure is optimistic.

   SO THIS FILE PINS TWO THINGS AND NO MORE:

     the halves are JUDGED SEPARATELY — a record measured on one direction
     does not describe the other and must not be used to condemn it. That
     claim needs no significance at all; it is about which population the
     evidence came from.

     the split is RECORDED FORWARD — hgFwdStatsOf carries byDir and the
     aggregate folds it, so in a year the question can be answered out of
     sample instead of re-argued in sample.

   Nothing here filters, weights or reorders anything.

   Run: node tests/test-omnigold-direction-split.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); passed++; console.log('  ok —', m); };

const store = {};
const doc = { getElementById: () => null, createElement: () => ({ style: {}, innerHTML: '',
                appendChild(){}, setAttribute(){}, classList: { add(){}, remove(){} },
                querySelector: () => null, querySelectorAll: () => [] }),
              querySelector: () => null, querySelectorAll: () => [], head: { appendChild(){} },
              body: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN, parseFloat,
              parseInt, JSON, Array, Object, Number, String, Promise, RegExp, Infinity, NaN,
              Float64Array, setTimeout: () => 0, clearTimeout: () => {}, document: doc,
              addEventListener: () => {}, fetch: () => Promise.reject(new Error('no net')),
              localStorage: { getItem: k => (k in store ? store[k] : null),
                              setItem: (k, v) => { store[k] = String(v); },
                              removeItem: k => { delete store[k]; } } };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
vm.createContext(ctx);
for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                 'hg-forward.js', 'plans.js', 'hg-gates.js', 'hg-plan.js', 'omniroute.js',
                 'omnigold.js']){
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  catch (e) { /* optional deps degrade */ }
}
const OG = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
const FWD = fs.readFileSync(path.join(ROOT, 'hg-forward.js'), 'utf8');

console.log('== the four pairs are named once, and every label in them is real ==');
{
  const pairs = ctx.OG_DIR_PAIRS;
  ok(Array.isArray(pairs) && pairs.length === 4, 'four direction-split detectors are declared');

  /* not a hand-written list: every label must be a mechanic the desk knows
     about, or the map would quietly point at nothing */
  const seen = {};
  for (const [lo, sh] of pairs){
    ok(typeof lo === 'string' && typeof sh === 'string' && lo !== sh, `${lo} / ${sh} is a real pair`);
    ok(!seen[lo] && !seen[sh], 'and no label appears in two pairs');
    seen[lo] = seen[sh] = 1;
  }

  /* the map resolves both ways, and only for labels that are in it */
  const s = ctx.hgOgDirSibling('SPRING');
  ok(s && s.kind === 'UTAD' && s.side === 'short' && s.selfSide === 'long',
     'SPRING resolves to UTAD as the short side');
  const u = ctx.hgOgDirSibling('UTAD');
  ok(u && u.kind === 'SPRING' && u.side === 'long' && u.selfSide === 'short',
     'and UTAD back to SPRING as the long side');
  ok(ctx.hgOgDirSibling('MMOVE') === null, 'a mechanic with no twin gets null');
  ok(ctx.hgOgDirSibling('') === null && ctx.hgOgDirSibling(null) === null,
     'and a missing kind is null, never a throw');
}

console.log('\n== nothing folds any more: each label carries its own record ==');
{
  ok(/var OG_KIND_ALIAS = \{\};/.test(OG), 'the alias map is empty');
  /* the machinery is kept on purpose — it is the right answer for labels
     that genuinely ARE one sample, and deleting it would put the next
     person back at an inline special case */
  ok(/function hgOgMergeReplayRows/.test(OG), 'the merge helper is kept for a pair that really is one');
  ok(/function hgOgKindGroup/.test(OG), 'and so is the grouping');

  const spring = ctx.hgOgReplayEvidence('SPRING');
  const utad = ctx.hgOgReplayEvidence('UTAD');
  ok(spring && utad && spring.n !== utad.n, 'SPRING and UTAD read different rows');
  ok(spring.n === 104 && utad.n === 91, `on their own samples (${spring.n} / ${utad.n})`);
  ok(spring.n + utad.n === 195, 'and neither is the 195-trade pooled record');
  ok(utad.winRate - spring.winRate > 0.15,
     `the short half is 19 points better (${(100 * spring.winRate).toFixed(1)}% vs ${(100 * utad.winRate).toFixed(1)}%)`);

  /* BOTH DIRECTIONS ARE REGISTERED MECHANICS. Un-pooling is incoherent
     unless the short label is something the desk counts: the family-wise
     bar is a function of how many were tested. */
  ok(/'SPRING','UTAD'/.test(OG), 'UTAD sits beside SPRING in OG_MECHANICS');
  ok(/UTAD:   function\(r\)\{/.test(OG), 'and has its own detector registration');
  ok(/return \(h && h\.kind === 'UTAD'\) \? h : null;/.test(OG),
     'which filters by kind, so one call cannot emit under the other label');
  ok(/return \(h && h\.kind === 'SPRING'\) \? h : null;/.test(OG), 'the long side likewise');
}

console.log('\n== un-pooling RAISES the bar — it does not let anything through ==');
{
  const m = ctx.hgOgReplayFamilySize();
  ok(m === 54, `the family counts every record tested (${m})`);
  ok(ctx.hgOgFamilyZ(m) > ctx.hgOgFamilyZ(53),
     'so admitting to one more comparison makes the bar harder, not easier');

  /* the verdict each half now gets, which is the point and which cuts both
     ways: the long half is condemned on its own record rather than rescued
     by the short half's */
  const BE = 1 / 3, z = ev => (ev.winRate - BE) / Math.sqrt(BE * (1 - BE) / ev.n);
  const spring = ctx.hgOgReplayEvidence('SPRING'), utad = ctx.hgOgReplayEvidence('UTAD');
  ok(z(spring) <= -2, `SPRING is vetoed on its own 104 trades (z ${z(spring).toFixed(2)})`);
  ok(z(utad) > -2, `UTAD is not (z ${z(utad).toFixed(2)})`);
  ok(z(utad) < ctx.hgOgFamilyZ(54),
     'and UTAD comes nowhere near the bar to be a ticket — this change buys the desk nothing');

  /* pooled, BOTH read the midpoint and BOTH came back unchecked — which is
     how the fold silently lifted a veto the long half had earned */
  const pooledHit = (spring.winRate * spring.n + utad.winRate * utad.n) / (spring.n + utad.n);
  const pooledZ = (pooledHit - BE) / Math.sqrt(BE * (1 - BE) / (spring.n + utad.n));
  ok(pooledZ > -2, `the pooled record would not have vetoed either (z ${pooledZ.toFixed(2)})`);
  ok(pooledHit > spring.winRate && pooledHit < utad.winRate,
     'because it sits between the two and describes neither');

  /* NO GOLD MECHANIC BECOMES A TICKET. The whole desk is still silent. */
  let cleared = 0;
  for (const [lo, sh] of ctx.OG_DIR_PAIRS){
    for (const k of [lo, sh]){
      const vd = ctx.hgOgReplayEdgeVerdict(ctx.hgOgReplayEvidence(k));
      if (vd && (vd.tier === 'naive' || vd.tier === 'family')) cleared++;
    }
  }
  ok(cleared === 0, 'no half of any of the four pairs clears its own breakeven');
}

console.log('\n== the card shows both halves, labelled as unestablished ==');
{
  const line = ctx.hgOgReplayLineHtml('SPRING');
  ok(/same detector, other side/.test(line), 'a SPRING card names the other half');
  ok(/UTAD \(short\)/.test(line), 'with the label and which side it is');
  ok(/n=91/.test(line) && /n=104/.test(line), 'and both sample sizes, so neither is quoted alone');
  ok(/not established/.test(line), 'and says the gap is not established');
  ok(!/NaN|undefined/.test(line), 'with nothing leaked');

  ok(!/same detector/.test(ctx.hgOgReplayLineHtml('MMOVE')),
     'a mechanic with no twin grows no such line');
  ok(ctx.hgOgDirSiblingLineHtml('PWL-SWEEP', null) === '',
     'and a pair whose halves have no measured record says nothing rather than half of it');
}

console.log('\n== the split is recorded forward, and absent is not a side ==');
{
  const N = ctx.hgFwdNormalize, S = ctx.hgFwdStatsOf;
  /* geometry has to match the side or hgFwdNormalize rejects the record —
     a short's stop sits ABOVE its entry. Which is itself worth knowing:
     the log will not accept a mislabelled side. */
  const base = { tab: 'OMNIGOLD:SCALP', mechanic: 'SPRING', sym: 'XAUUSD', tf: '1h',
                 horizonBars: 24 };
  const geo = dir => (dir === 'short')
    ? { entry: 4700, stop: 4730, t1: 4640 }
    : { entry: 4700, stop: 4670, t1: 4760 };
  const mk = (i, o) => Object.assign(N(Object.assign({}, base, geo(o.dir),
    { barT: 1700000000 + i * 3600, dir: o.dir })), o);

  const list = [mk(0, { dir: 'long', state: 'stop' }), mk(1, { dir: 'long', state: 'stop' }),
                mk(2, { dir: 'long', state: 't1' }),   mk(3, { dir: 'short', state: 't1' }),
                mk(4, { dir: 'short', state: 't1' }),  mk(5, { dir: 'short', state: 'stop' })];
  const st = S(list, 'OMNIGOLD:SCALP', 'SPRING', false, null);

  ok(st.byDir, 'the stats carry a side breakdown');
  ok(st.byDir.long.n === 3 && st.byDir.long.w === 1, 'three long, one of them a win');
  ok(st.byDir.short.n === 3 && st.byDir.short.w === 2, 'three short, two of them wins');
  ok(st.byDir.long.n + st.byDir.short.n === st.samples, 'and every settled record lands on a side');

  /* the measurement must be able to report AGAINST the in-sample finding,
     or it is not a test of it */
  const flipped = [mk(0, { dir: 'long', state: 't1' }), mk(1, { dir: 'long', state: 't1' }),
                   mk(2, { dir: 'short', state: 'stop' })];
  const fs2 = S(flipped, 'OMNIGOLD:SCALP', 'SPRING', false, null);
  ok(fs2.byDir.long.w / fs2.byDir.long.n > fs2.byDir.short.w / fs2.byDir.short.n,
     'on a fixture where long wins, the split says long wins — it is not wired to one answer');

  /* a record with no side is counted in the totals and in NEITHER bucket */
  const noDir = [mk(0, { dir: 'long', state: 't1' }),
                 Object.assign(N(Object.assign({}, base, geo('long'),
                                 { barT: 1700009999, dir: 'long' })),
                               { dir: '', state: 'stop' })];
  const ns = S(noDir, 'OMNIGOLD:SCALP', 'SPRING', false, null);
  ok(ns.samples === 2, 'both records settle');
  ok(ns.byDir.long.n === 1 && ns.byDir.short.n === 0,
     'but the sideless one is in no bucket — never defaulted to long, which would hand one half the other\'s losses');
}

console.log('\n== and it survives pruning, or it could never accumulate ==');
{
  const F = ctx.hgFwdFold, N = ctx.hgFwdNormalize, S = ctx.hgFwdStatsOf;
  const base = { tab: 'OMNIGOLD:SCALP', mechanic: 'SPRING', sym: 'XAUUSD', tf: '1h',
                 horizonBars: 24 };
  const geo = dir => (dir === 'short')
    ? { entry: 4700, stop: 4730, t1: 4640 }
    : { entry: 4700, stop: 4670, t1: 4760 };
  const mk = (i, dir, state) => Object.assign(
    N(Object.assign({}, base, geo(dir), { barT: 1700000000 + i * 3600, dir: dir })),
    { dir: dir, state: state });

  const pruned = [mk(0, 'short', 't1'), mk(1, 'short', 't1'), mk(2, 'long', 'stop')];
  const agg = F({}, pruned);
  const key = 'OMNIGOLD:SCALP|SPRING';
  ok(agg[key], 'the fold writes a block for the tab and mechanic');
  ok(agg[key].dir_short && agg[key].dir_short.n === 2 && agg[key].dir_short.w === 2,
     'the short side folds with its wins');
  ok(agg[key].dir_long && agg[key].dir_long.n === 1 && agg[key].dir_long.w === 0,
     'and the long side with its losses');

  /* THE POINT: read back with the live records GONE. Left to the live list
     this split would be a rolling four-week view forever, which is the one
     window that cannot answer a question needing years. */
  const st = S([], 'OMNIGOLD:SCALP', 'SPRING', false, agg);
  ok(st.byDir.short.n === 2 && st.byDir.long.n === 1,
     'and it reads back from the aggregate after every live record is pruned');
  ok(st.samples === 3, 'with the totals intact alongside it');

  ok(/read over years/.test(FWD), 'and the source says why it rides the unfiltered path');
}

console.log('\n== this is a measurement, not a trading rule ==');
{
  /* The session that found the 0.50% stop floor fitted to one end of an
     interval does not get to add a directional filter on in-sample
     evidence. Recorded, reported, used for nothing. */
  ok(!/byDir/.test(OG), 'omnigold reads byDir nowhere — no gate, no weight, no ordering');
  ok(/used for NOTHING/.test(FWD), 'and hg-forward says so where the bucket is declared');
  ok(/100 \* tapeScore/.test(OG) && /120 \* ticketN/.test(OG), 'every ranker weight is as it was');
  ok(!/dir === 'short'.*score|score.*dir === 'short'/.test(OG), 'nothing scores a side');

  /* the honest caveats are recorded next to the finding, not in a commit
     message where the next reader will not see them */
  ok(/not established/.test(OG), 'the card calls the gap unestablished');
  ok(/family-wise bar of 2\.234/.test(FWD), 'and the log names the bar it fails');
  ok(/in-sample/.test(FWD), 'and that it is in-sample');
}

console.log('\n' + passed + ' passed, 0 failed');
