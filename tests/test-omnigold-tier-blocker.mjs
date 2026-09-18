/* HARDGATE — the card names the constraint that actually binds.

   The below-the-bar line asserted one blocker unconditionally:

     "clears breakeven by 3.8 pts, below the 25-trade minimum"

   printed on a row carrying 63 trades. That is a false statement about the
   evidence, on the panel whose whole job is to report the evidence.

   It was true once, when the sample minimum was the only thing between a
   positive margin and a promotion. Packs 834, 835 and 836 each added
   another: the population must be this mechanic's own, the bound is
   corrected for the 77-mechanic family, and it is deflated by the record's
   own measured overlap. Four gates, and the card named whichever one was
   written into the template.

   The same row then contradicted itself — "NOT this mechanic's own record",
   the real blocker, two clauses after claiming the sample minimum was.

   THE SCALP VERDICT PANEL HAD THE SAME SHAPE, and pack 838 gives it the
   same walk. Its below-the-bar line read "below 90% lower bound"
   unconditionally, which on a desk-pool row printed:

     "81/83 wins · 98% hit · Wilson 95% CI 92-99% · below 90% lower bound"

   A 95% interval whose lower bound is 92%, described on the same line as
   below 90%. The real blocker was the population, stated after it, so the
   line contradicted both the number beside it and the clause after it.

   The two tiers do not test the same thing — PROVEN EDGE tests the bound
   against this mechanic's own breakeven, the verdict against a fixed rate —
   so the walk takes an options object rather than being copied, which is
   how two copies start drifting.

   Run: node tests/test-omnigold-tier-blocker.mjs */
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
const T = 1700000000, FWD = 'hg_forward_v1';
/* 48h apart so overlap is 1.0 and only the gate under test moves */
const recs = (tab, mech, n, wins, rr, opts) => {
  const out = [];
  for (let i = 0; i < n; i++){
    const w = i < wins;
    out.push({ tab, mechanic: mech, sym: 'XAUUSD', tf: (opts && opts.tf !== undefined) ? opts.tf : '1h',
               dir: 'long', entry: 4000, stop: 3980, t1: 4000 + 20 * rr, risk: 20, rr,
               barT: T + i * 172800, horizonBars: 20,
               state: w ? 't1' : 'stop', r: w ? rr : -1, settledT: T + i * 172800 + 3600,
               ticket: true, gateClear: true, shown: true });
  }
  return out;
};
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
                            .replace(/&middot;/g, '·').replace(/\s+/g, ' ').trim();
const card = (ev, hz) => ({ horizon: hz || 'SWING', kind: 'ROUND-MAGNET', dir: 'long',
                            plan: { entry: 4000, stop: 3980, t1: 4040, t2: 4080 }, settledEv: ev });

console.log('== the row that was lying, and what it says now ==');
{
  /* a thin mechanic borrowing the desk pool: 63 trades, positive margin,
     blocked by the POPULATION and nothing else */
  const C = boot({ [FWD]: JSON.stringify(
    recs('OMNIGOLD:SCALP', 'ROUND-MAGNET', 3, 2, 2)
      .concat(recs('OMNIGOLD:SCALP', 'FVG-FILL', 60, 34, 2))) });
  const ev = C.hgOgSettledEvidence({ horizon: 'SCALP', kind: 'ROUND-MAGNET', dir: 'long' });
  ok(ev && ev.samples === 63, `the row carries ${ev.samples} settled trades`);
  ok(ev.specific === false, 'and is measured on the desk pool, not on the mechanic');
  ok(C.hgOgEdgeMargin(ev) > 0, `with a POSITIVE margin (${(C.hgOgEdgeMargin(ev) * 100).toFixed(1)} pts)`);
  ok(C.hgOgProvenEdgeOk(ev, 25, 0.02) === false, 'and it does not promote');

  /* THE OLD TEMPLATE, reimplemented, so the lie is demonstrated */
  const oldTxt = 'clears breakeven by ' + (C.hgOgEdgeMargin(ev) * 100).toFixed(1)
               + ' pts, below the 25-trade minimum';
  ok(/below the 25-trade minimum/.test(oldTxt) && ev.samples > 25,
     `the old line read "${oldTxt}" on a ${ev.samples}-trade record — a false statement about the evidence`);

  const html = strip(C.hgOgSettledExecutePanelHtml({ proven: [], best: [card(ev, 'SCALP')] }));
  ok(!/below the 25-trade minimum/.test(html), 'the shipped card no longer says that');
  ok(/held by: the population it is measured on/.test(html),
     'it names the gate that actually binds');
  ok(/36\/63 wins/.test(html), 'while still reporting the record as recorded');
  ok(/NOT this mechanic's own record/.test(html) || /NOT this mechanic&#39;s own record/.test(html),
     'and the scope clause still explains which mechanic and which minimum');
}

console.log('\n== each gate names itself ==');
{
  const B = (ev, minN, margin) => boot().hgOgTierBlock(ev, minN, margin);
  const W = boot();
  ok(typeof W.hgOgTierBlock === 'function', 'hgOgTierBlock is exported');

  ok(B(null).key === 'no-record', 'no evidence at all is named as such');
  ok(B({ samples: 10 }).key === 'no-record', 'and so is evidence with no interval');

  const base = (over) => Object.assign(
    { samples: 60, wins: 40, avgRr: 2, specific: true, overlapRatio: 1, effSamples: 60,
      wilson: W.hgWilson(40, 60, 1.96), wilsonFam: W.hgWilson(40, 60, 3.2091) }, over || {});

  ok(B(base({ specific: false })).key === 'population', 'a borrowed population is named first');
  ok(B(base({ avgRr: undefined })).key === 'breakeven',
     'then a record with no reward multiple — there is no breakeven to clear');
  const few = B(base({ samples: 9, wilson: W.hgWilson(6, 9, 1.96), wilsonFam: W.hgWilson(6, 9, 3.2091) }), 25);
  ok(few.key === 'samples' && /9 of the 25 settled trades/.test(few.txt),
     `then the sample minimum, quoting both counts: "${few.txt}"`);
  const weak = B(base({ wins: 22, wilson: W.hgWilson(22, 60, 1.96), wilsonFam: W.hgWilson(22, 60, 3.2091) }));
  ok(weak.key === 'bound' && /pts short of breakeven at the corrected bar/.test(weak.txt),
     `then the bound itself: "${weak.txt}"`);
  ok(B(base()).key === 'none', 'and a row with nothing blocking it says so');
  ok(/row and the tier gate disagree/.test(B(base()).txt),
     'in words that flag the disagreement rather than inventing a fifth reason');

  /* ORDER MATTERS: the gates are reported in the order the tier applies
     them, so a row failing two is named by the one that fires first. */
  const two = B(base({ specific: false, samples: 3 }));
  ok(two.key === 'population',
     'a row failing both population and samples is named by the population — the order the tier tests in');
}

console.log('\n== the overlap shows up where it is the reason ==');
{
  const W = boot();
  const ev = { samples: 40, wins: 28, avgRr: 2, specific: true,
               overlapRatio: 0.0738, effSamples: 2.95,
               wilson: W.hgWilson(28, 40, 1.96),
               wilsonFam: W.hgWilson(28 * 0.0738, Math.max(1, 40 * 0.0738), 3.2091) };
  const blk = W.hgOgTierBlock(ev, 25, 0.02);
  ok(blk.key === 'bound', 'an overlapping record fails on the bound');
  ok(/on 3\.0 effective trades/.test(blk.txt),
     `and the reason says how much sample survived: "${blk.txt}"`);
  const clean = W.hgOgTierBlock(Object.assign({}, ev, {
    overlapRatio: 1, effSamples: 40, wilsonFam: W.hgWilson(28, 40, 3.2091) }), 25, 0.02);
  ok(!/effective/.test(clean.txt),
     'while an unoverlapped record does not carry the clause at all — no deflation, nothing to report');
}

console.log('\n== the 90% SCALP VERDICT row gets the same walk ==');
{
  /* CASE: a desk-pool row whose DISPLAYED lower bound is above 90%. The old
     line said "below 90% lower bound" next to a printed 92%. */
  const C = boot({ [FWD]: JSON.stringify(
    recs('OMNIGOLD:SCALP', 'ROUND-MAGNET', 3, 3, 2)
      .concat(recs('OMNIGOLD:SCALP', 'FVG-FILL', 80, 78, 2))) });
  const ev = C.hgOgSettledEvidence({ horizon: 'SCALP', kind: 'ROUND-MAGNET', dir: 'long' });
  ok(ev.specific === false && ev.samples === 83, `the row is the desk pool on ${ev.samples} trades`);
  ok(ev.wilson.lo > 0.90,
     `whose DISPLAYED lower bound is ${(ev.wilson.lo * 100).toFixed(0)}% — above the 90% bar`);
  ok(C.hgOgSettledExecuteOk(ev, 0.90, 10) === false, 'and it still does not clear the verdict');

  const html = strip(C.hgOgScalpVerdictPanelHtml({ go: null, bestBelow: [
    { horizon: 'SCALP', kind: 'ROUND-MAGNET', dir: 'long',
      plan: { entry: 4000, stop: 3980, t1: 4040, t2: 4080 }, verdictEv: ev }] }));
  ok(/Wilson 95% CI 92/.test(html), 'the card prints that 92% lower bound');
  ok(!/below 90% lower bound/.test(html),
     'and no longer claims "below 90% lower bound" on the same line');
  ok(/held by: the population it is measured on/.test(html), 'it names the population instead');

  /* and the sample-minimum case names the minimum, not the bound */
  const C2 = boot({ [FWD]: JSON.stringify(recs('OMNIGOLD:SCALP', 'ROUND-MAGNET', 4, 4, 2)) });
  const ev2 = C2.hgOgSettledEvidence({ horizon: 'SCALP', kind: 'ROUND-MAGNET', dir: 'long' });
  ok(ev2.samples === 4 && ev2.specific === true, 'a 4/4 record on the mechanic itself');
  const html2 = strip(C2.hgOgScalpVerdictPanelHtml({ go: null, bestBelow: [
    { horizon: 'SCALP', kind: 'ROUND-MAGNET', dir: 'long',
      plan: { entry: 4000, stop: 3980, t1: 4040, t2: 4080 }, verdictEv: ev2 }] }));
  ok(/held by: 4 of the 10 settled trades this tier needs/.test(html2),
     'is held by the sample minimum, quoted with both counts');
  ok(!/below 90% lower bound/.test(html2), 'not by the bound it would also miss');
}

console.log('\n== the rate tier and the breakeven tier test different things ==');
{
  const W = boot();
  const base = (over) => Object.assign(
    { samples: 60, wins: 40, avgRr: 2, specific: true, overlapRatio: 1, effSamples: 60,
      wilson: W.hgWilson(40, 60, 1.96), wilsonFam: W.hgWilson(40, 60, 3.2091) }, over || {});

  /* 40/60 at R=2: breakeven is 33%, so the PROVEN tier passes it... */
  ok(W.hgOgTierBlock(base(), 25, 0.02).key === 'none',
     'a 40/60 record at 2R clears its own breakeven');
  /* ...while the 90% rate tier does not, and says by how much */
  const rate = W.hgOgTierBlock(base(), { minN: 10, minLo: 0.90 });
  ok(rate.key === 'bound', 'and fails the 90% rate bar');
  ok(/pts short of 90%/.test(rate.txt), `naming the rate it missed: "${rate.txt}"`);
  /* A REAL DISTANCE, not "NaN pts". Mutating the target to the breakeven one
     in the rate path left the string matching the pattern above while the
     number was NaN — the pattern passed and the sentence was nonsense, which
     is exactly what this file exists to stop. */
  ok(/^\d+\.\d pts short of 90%/.test(rate.txt),
     `and quoting it as a number: "${rate.txt.split(' at the')[0]}"`);
  ok(Math.abs(parseFloat(rate.txt) - (0.90 - W.hgWilson(40, 60, 3.2091).lo) * 100) < 0.05,
     'which is the actual distance from the corrected bound to the 90% bar');
  ok(/against the .*% shown/.test(rate.txt),
     'and setting the corrected bound beside the displayed one, so the two cannot read as a contradiction');

  /* a record with NO reward multiple can still be judged on a rate */
  const noRr = base({ avgRr: undefined });
  ok(W.hgOgTierBlock(noRr, 25, 0.02).key === 'breakeven',
     'the breakeven tier cannot judge a record with no R');
  ok(W.hgOgTierBlock(noRr, { minN: 10, minLo: 0.90 }).key === 'bound',
     'while the rate tier can — it never needed one');

  /* the gates before the last are shared, so they cannot drift apart */
  for (const opts of [[25, 0.02], [{ minN: 10, minLo: 0.90 }]]){
    ok(W.hgOgTierBlock(base({ specific: false }), ...opts).key === 'population',
       'both tiers name the population first');
    ok(W.hgOgTierBlock(base({ samples: 2 }), ...opts).key === 'samples',
       'and the sample minimum before the bound');
  }
}

console.log('\n== and nothing renders a number it does not have ==');
{
  const W = boot();
  let rendered = 0;
  for (const specific of [true, false, undefined]){
    for (const avgRr of [2, undefined, null, NaN, 0, -1]){
      for (const samples of [0, 3, 63, null, NaN]){
        for (const ratio of [1, 0.4, null, NaN]){
          const ev = { samples, wins: 20, avgRr, specific, overlapRatio: ratio,
                       effSamples: (ratio && samples) ? samples * ratio : NaN,
                       wilson: W.hgWilson(20, 40, 1.96), wilsonFam: W.hgWilson(20, 40, 3.2091) };
          /* BOTH TIER SHAPES. The breakeven form alone left the rate form's
             arithmetic unfuzzed, and a mutation that made it compute NaN
             went unnoticed until it was tried. */
          for (const opts of [[25, 0.02], [{ minN: 10, minLo: 0.90 }], [{ minN: 15, minLo: 0.95 }]]){
            let blk;
            try { blk = W.hgOgTierBlock(ev, ...opts); }
            catch (e) { throw new Error('FAIL: hgOgTierBlock threw on ' + JSON.stringify(ev)
                                        + ' / ' + JSON.stringify(opts) + ' — ' + e.message); }
            rendered++;
            if (!blk || typeof blk.txt !== 'string' || !blk.txt)
              throw new Error('FAIL: no reason for ' + JSON.stringify(ev));
            if (/NaN|undefined|\[object/.test(blk.txt))
              throw new Error('FAIL: reason read "' + blk.txt + '" for ' + JSON.stringify(opts));
          }
        }
      }
    }
  }
  ok(rendered === 3 * 6 * 5 * 4 * 3,
     `${rendered} evidence shapes across both tier forms: every one produced a reason, `
     + 'none printed NaN or undefined');
}

console.log('\n' + passed + ' passed, 0 failed');
