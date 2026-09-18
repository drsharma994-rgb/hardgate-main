/* HARDGATE — concurrent trades are not independent bets.

   The measured-edge gate already deflates the horizon book for overlap,
   measured from the log's own barT and horizonBars rather than by borrowing
   the replay's 0.406, and states the rule it acts on:

     "NO MEASUREMENT, NO PROMOTION. Treating an unmeasurable overlap as 1.0
      is precisely the assumption that inflates the statistic."

   The three evidence tiers — PROVEN EDGE, 95% SETTLED EXECUTE, 90% SCALP
   VERDICT — read the same ledger and did not. Two parts of one tab held
   different assumptions about the same records, and the part that promotes
   to the headline panel was the one assuming independence.

   A mechanic firing on consecutive bars holds several positions at once.
   horizonBars 20 on a 1h timeframe is a 20-hour hold, so forty firings two
   hours apart are worth about three independent trades — and a Wilson bound
   computed on forty of them is tighter than the evidence supports.

   Measured across spacings, 40 records at 28 wins:

     spacing   ratio    effective n    decision bound
       1h      0.074        3.0           0.1116
       4h      0.220        8.8           0.2388
      12h      0.610       24.4           0.3840
      24h      1.000       40.0           0.4477

   Run: node tests/test-omnigold-overlap-deflation.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(seed){
  const store = Object.create(null);
  if (seed) for (const k of Object.keys(seed)) store[k] = seed[k];
  const doc = { getElementById: () => null,
                createElement: () => ({ style: {}, classList: { add(){}, remove(){} },
                                        appendChild(){}, setAttribute(){} }),
                querySelector: () => null, querySelectorAll: () => [],
                head: { appendChild(){} }, body: { appendChild(){} }, addEventListener(){} };
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date, RegExp, document: doc,
                setTimeout: () => 0, clearTimeout: () => {}, addEventListener: () => {},
                fetch: () => Promise.reject(new Error('no net')),
                localStorage: { getItem: k => (k in store ? store[k] : null),
                                setItem: (k, v) => { store[k] = String(v); },
                                removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = [];
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
                   'hg-forward.js', 'scorecard.js', 'formation.js', 'plans.js', 'hg-gates.js',
                   'hg-plan.js', 'omniroute.js', 'omnigold.js']){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade */ }
  }
  return ctx;
}
const T = 1700000000;
const FWD = 'hg_forward_v1';
/* spacingH apart, each held horizonBars(20) x 1h = 20 hours */
const recs = (n, wins, rr, spacingH, opts) => {
  const gap = spacingH * 3600;
  const out = [];
  for (let i = 0; i < n; i++){
    const w = i < wins;
    const r = { tab: 'OMNIGOLD:SWING', mechanic: 'ROUND-MAGNET', sym: 'XAUUSD',
                tf: (opts && opts.tf !== undefined) ? opts.tf : '1h', dir: 'long',
                entry: 4000, stop: 3980, t1: 4000 + 20 * rr, risk: 20, rr,
                barT: T + i * gap,
                horizonBars: (opts && opts.horizonBars !== undefined) ? opts.horizonBars : 20,
                state: w ? 't1' : 'stop', r: w ? rr : -1, settledT: T + i * gap + 3600,
                ticket: true, gateClear: true, shown: true };
    out.push(r);
  }
  return out;
};
const ROW = { horizon: 'SWING', kind: 'ROUND-MAGNET', dir: 'long' };
const evAt = (spacingH, n, wins, rr, opts) => {
  const C = boot({ [FWD]: JSON.stringify(recs(n || 40, wins || 28, rr || 2, spacingH, opts)) });
  return { C, ev: C.hgOgSettledEvidence(ROW) };
};

console.log('== the overlap is measured, not borrowed ==');
{
  const { C, ev } = evAt(48);
  ok(typeof C.hgFwdOverlap === 'function', 'the ledger can measure its own overlap');
  ok(typeof C.hgOgSettledOverlapRatio === 'function', 'and the tab asks it to');
  ok(ev && isFinite(ev.overlapRatio), `a spaced book measures a ratio (${ev.overlapRatio})`);
  ok(ev.overlapRatio === 1,
     '48h apart with a 20h hold is no overlap at all, so nothing is deflated');
  ok(ev.effSamples === ev.samples, 'and the effective sample equals the raw one');

  /* THE REPLAY CONSTANT IS NOT REUSED. Borrowing 0.406 — measured on the
     in-sample walk — is the error hgFwdOverlap exists to avoid. */
  ok(C.HG_OG_EFF_N_RATIO === 0.406, 'the replay constant is still 0.406 where it belongs');
  ok(ev.overlapRatio !== C.HG_OG_EFF_N_RATIO,
     'and this population measured its own, rather than inheriting that one');
}

console.log('\n== overlap deflates the bound that decides, in proportion ==');
{
  const seen = [];
  for (const sp of [1, 4, 12, 24, 48]){
    const { C, ev } = evAt(sp);
    seen.push({ sp, ratio: ev.overlapRatio, eff: ev.effSamples,
                disp: ev.wilson.lo, dec: ev.wilsonFam.lo,
                proven: C.hgOgProvenEdgeOk(ev, 25, 0.02) });
  }
  for (let i = 1; i < seen.length; i++){
    if (!(seen[i].ratio >= seen[i - 1].ratio))
      throw new Error('FAIL: ratio fell as spacing grew — ' + JSON.stringify(seen));
    if (!(seen[i].dec >= seen[i - 1].dec))
      throw new Error('FAIL: the decision bound fell as overlap eased — ' + JSON.stringify(seen));
  }
  ok(true, 'wider spacing is a higher ratio and a higher decision bound, monotonically — '
     + seen.map(x => x.sp + 'h:' + x.ratio.toFixed(3)).join(' '));
  ok(Math.abs(seen[0].ratio - 0.0738) < 0.002 && Math.abs(seen[0].eff - 3.0) < 0.2,
     `40 firings an hour apart on a 20h hold are worth ${seen[0].eff.toFixed(1)} independent trades`);
  ok(seen[0].proven === false && seen[seen.length - 1].proven === true,
     'so the same 28/40 record proves an edge when the trades are separate and does not when they are one bet');

  /* THE DISPLAYED INTERVAL IS UNTOUCHED, as pack 835 established: one number
     to read, one to decide, and the reader can still check the readable one. */
  const disp = seen.map(x => x.disp);
  ok(disp.every(d => Math.abs(d - disp[0]) < 1e-12),
     `the displayed 95% CI is the same ${disp[0].toFixed(4)} at every spacing — it describes `
     + 'the observed record, which did not change');
  const { C: C0, ev: ev0 } = evAt(1);
  const ref = C0.hgWilson(28, 40, 1.96);
  ok(ev0.wilson.lo === ref.lo, 'and still matches a hand computation from wins/samples');
  ok(ev0.wilsonFam.lo < ev0.wilson.lo, 'while the decision bound sits below it');
  ok(Math.abs(ev0.wilson.p - ev0.wilsonFam.p) < 1e-12,
     'both describing the same observed rate — deflation widens an interval, it does not move it');
}

console.log('\n== when it cannot be measured, the card says so ==');
{
  /* no timeframe on the records means no span, so no concurrency */
  const { C, ev } = evAt(48, 40, 28, 2, { tf: '' });
  ok(!isFinite(ev.overlapRatio), 'a record with no timeframe yields no ratio');
  ok(C.hgOgOverlapKnown(ev) === false, 'which the tab reports as unknown rather than as 1.0');
  const txt = C.hgOgOverlapScopeTxt(ev);
  ok(/not measurable/.test(txt) && /not independent bets/.test(txt)
     && /tighter than the evidence supports/.test(txt),
     `and the card explains it, including which way the error runs: "${txt.trim()}"`);
  ok(!/NaN|undefined/.test(txt), 'without printing NaN');

  const { C: C2, ev: ev2 } = evAt(48);
  const txt2 = C2.hgOgOverlapScopeTxt(ev2);
  ok(/40 settled, effective 40\.0 after overlap/.test(txt2),
     `a measured one quotes both counts: "${txt2.trim()}"`);
  const { ev: ev3, C: C3 } = evAt(1);
  ok(/effective 3\.0 after overlap/.test(C3.hgOgOverlapScopeTxt(ev3)),
     'and an overlapping one shows how much of the sample survives');
}

console.log('\n== an unmeasurable overlap withholds the claim, NOT the tier ==');
{
  /* A DESIGN DECISION I REVERSED MID-IMPLEMENTATION, recorded because it is
     a judgement and not an obvious one.

     My first attempt applied the gate's "no measurement, no promotion" rule
     here too. It is wrong in this place. These tiers read a record whose
     `samples` include history long since folded into the pruned aggregate,
     while spans can only be measured on raw records still in the live list.
     A mechanic with a long, strong, fully-pruned history would have become
     permanently unpromotable — its tier decided by the ledger's retention
     window rather than by its evidence. That is not the conservative
     direction, it is a different defect. */
  const { C, ev } = evAt(48, 40, 34, 2, { tf: '' });
  ok(C.hgOgOverlapKnown(ev) === false, 'the fixture has no measurable overlap');
  ok(C.hgOgProvenEdgeOk(ev, 25, 0.02) === true,
     'and a strong record still promotes — the family-corrected bound still stands');
  ok(/not measurable/.test(C.hgOgOverlapScopeTxt(ev)),
     'what is withheld is the CLAIM to have measured it, which the card states');

  /* and the gate's own rule is untouched where it belongs */
  const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(/NO MEASUREMENT, NO PROMOTION/.test(SRC),
     'the measured-edge gate still refuses to promote without a measurement');
  ok(/horizon book has .* but its overlap cannot be/.test(SRC),
     'and still says so on its own path');
}

console.log('\n== the deflation reaches the rendered panel ==');
{
  const { C, ev } = evAt(1);
  const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
                              .replace(/&middot;/g, '·').replace(/\s+/g, ' ').trim();
  const cand = { horizon: 'SWING', kind: 'ROUND-MAGNET', dir: 'long',
                 plan: { entry: 4000, stop: 3980, t1: 4040, t2: 4080 }, settledEv: ev };
  const html = strip(C.hgOgSettledExecutePanelHtml({ proven: [], best: [cand] }));
  ok(/effective 3\.0 after overlap/.test(html),
     'the PROVEN EDGE panel shows the effective sample beside the raw one');
  ok(/28\/40 wins/.test(html), 'while still reporting the record as it was recorded');
  ok(!/NaN|undefined/.test(html), 'without printing NaN or undefined');
}

console.log('\n' + passed + ' passed, 0 failed');
