/* HARDGATE — the promotion bar counts how many mechanics were tried.

   hgOgReplayEdgeVerdict keeps two bounds: lo95 for the panel to display,
   and loFw at hgOgFamilyZ(78) for the verdict to act on. Its comment states
   the rule for the whole file:

     "Every other site asking 'did this beat breakeven, allowing for how many
      were tried' calls hgOgFamilyZ(OG_MECHANICS.length)."

   That was not true of the forward tiers. hgOgProvenEdgeOk asks exactly that
   question — "the Wilson lower bound sits above breakeven by a real margin"
   — and asked it at an uncorrected 1.96, across all 78 mechanics the desk
   scans, on every bake.

   One-sided alpha 2.5% per test over 78 tests:

     P(at least one mechanic clears by luck)   86.1%
     expected false promotions per bake        1.95

   Sweeping every (wins, n) from 25 to 200 trades at R = 1.5 / 2 / 3: 6,296
   records clear both bars, 5,304 clear neither, and 658 — 9.5% of
   everything that promoted — cleared only the uncorrected one. Those are
   the thin just-over-the-line records a 78-way search manufactures.

   Run: node tests/test-omnigold-family-bar.mjs */
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
const W = boot();
const T = 1700000000;
const FWD = 'hg_forward_v1';
/* SPACED 48 HOURS APART ON PURPOSE. horizonBars 20 on a 1h tf is a 20-hour
   hold, so firings two hours apart are one bet wearing twenty names, and
   pack 836 deflates them for it. This file is about the FAMILY correction,
   so its fixtures are genuinely independent trades and the overlap ratio is
   1.0 — otherwise every number here would be testing two corrections at
   once. test-omnigold-overlap-deflation.mjs covers the other one. */
const SPACING_H = 48;
const recs = (n, wins, rr, spacingH) => {
  const gap = (spacingH || SPACING_H) * 3600;
  const out = [];
  for (let i = 0; i < n; i++){
    const w = i < wins;
    out.push({ tab: 'OMNIGOLD:SWING', mechanic: 'ROUND-MAGNET', sym: 'XAUUSD', tf: '1h', dir: 'long',
               entry: 4000, stop: 3980, t1: 4000 + 20 * rr, risk: 20, rr,
               barT: T + i * gap, horizonBars: 20,
               state: w ? 't1' : 'stop', r: w ? rr : -1, settledT: T + i * gap + 3600,
               ticket: true, gateClear: true, shown: true });
  }
  return out;
};
const ROW = { horizon: 'SWING', kind: 'ROUND-MAGNET', dir: 'long' };

console.log('== the family, and the bar it implies ==');
{
  ok(typeof W.hgOgPromotionZ === 'function' && typeof W.hgOgFamilyZ === 'function',
     'the promotion bar is a function, not a literal');
  const m = W.HG_OG_MECHANIC_COUNT;
  /* hg-v923 registered SWEEP-OB, so the family the bar corrects for is 78.
     That WIDENS the correction (z 3.2091 -> 3.2128): registering a mechanic
     makes the promotion bar stricter for every other one, which is the
     correct direction and the reason this number is derived, not written. */
  ok(m === 78, `the desk scans ${m} mechanics`);
  const z = W.hgOgPromotionZ();
  ok(Math.abs(z - 3.2128) < 0.001, `the Sidak one-sided bar over that family is +${z.toFixed(4)}σ`);
  ok(z === W.hgOgFamilyZ(m),
     'the SAME bar the replay verdict already uses — one family correction, not a second one');
  ok(z > 1.96, 'and it is stricter than the uncorrected 95% z it replaces');

  /* COUNTED, not written down: adding a mechanic must tighten the bar */
  ok(W.hgOgFamilyZ(m + 20) > z && W.hgOgFamilyZ(1) < z,
     'a bigger family is a stricter bar and a family of one is the loosest');
  ok(Math.abs(W.hgOgFamilyZ(1) - 1.6449) < 0.001,
     'a family of one is the plain one-sided 95% z (1.645), so the correction is Sidak and not an offset');

  /* the arithmetic that motivates it */
  const pAny = 1 - Math.pow(0.975, m);
  ok(pAny > 0.85 && pAny < 0.87,
     `at an uncorrected 1.96 the chance SOME mechanic clears by luck is ${(pAny * 100).toFixed(1)}%`);
  ok(Math.abs(m * 0.025 - 1.95) < 0.01,
     `— about ${(m * 0.025).toFixed(2)} false promotions per bake`);
}

console.log('\n== every evidence object carries both bounds ==');
{
  const C = boot({ [FWD]: JSON.stringify(recs(40, 28, 2)) });
  const ev = C.hgOgSettledEvidence(ROW);
  ok(ev && ev.wilson && ev.wilsonFam, 'the displayed 95% bound and the corrected one, side by side');
  ok(ev.wilsonFam.lo < ev.wilson.lo,
     `the corrected bound is lower (${ev.wilsonFam.lo.toFixed(4)} against ${ev.wilson.lo.toFixed(4)}) — `
     + 'a wider interval is what a stricter z buys');
  ok(Math.abs(ev.wilson.p - ev.wilsonFam.p) < 1e-12,
     'both describe the same observed rate — a stricter z widens an interval, it does not move it');
  ok(ev.overlapRatio === 1,
     'and these fixtures are spaced so the overlap ratio is 1.0, isolating the family correction');
  ok(C.hgOgEvBound(ev) === ev.wilsonFam, 'and a tier reads the corrected one');

  /* THE DISPLAYED INTERVAL IS STILL A 95% INTERVAL. Relabelling a
     descriptive statistic to make a decision rule fit would be backwards. */
  const ref = C.hgWilson(28, 40, 1.96);
  ok(ev.wilson.lo === ref.lo && ev.wilson.hi === ref.hi,
     'ev.wilson is untouched at z=1.96, which is what the card prints as "Wilson 95% CI"');

  /* a record from before this existed must not become un-promotable */
  const legacy = { samples: 40, wins: 28, avgRr: 2, specific: true, wilson: ev.wilson };
  ok(C.hgOgEvBound(legacy) === legacy.wilson,
     'an evidence object with no corrected bound falls back to the 95% one rather than to null');
}

console.log('\n== the marginal promotions are the ones that go ==');
{
  /* Driven against both bars, with the records the sweep identified. */
  const cases = [
    /* wins, n, R, clears 1.96, clears corrected */
    [14, 25, 2,   true,  false],
    [15, 25, 2,   true,  false],
    [12, 25, 3,   true,  false],
    [16, 25, 1.5, true,  false],
    [34, 40, 2,   true,  true],
    [60, 80, 2,   true,  true],
    [8,  25, 2,   false, false]
  ];
  let removed = 0, kept = 0;
  for (const [wins, n, rr, old196, wantFam] of cases){
    const C = boot({ [FWD]: JSON.stringify(recs(n, wins, rr)) });
    const ev = C.hgOgSettledEvidence(ROW);
    const be = C.hgOgBreakevenHit(rr);
    const was = ev.wilson.lo >= be + 0.02;          /* the OLD rule, reimplemented */
    ok(was === old196,
       `${wins}/${n} at R=${rr}: the uncorrected bar ${old196 ? 'promoted' : 'rejected'} it `
       + `(lo ${ev.wilson.lo.toFixed(4)} vs breakeven+margin ${(be + 0.02).toFixed(4)})`);
    const now = C.hgOgProvenEdgeOk(ev, n, 0.02);
    ok(now === wantFam,
       `and the shipped bar ${wantFam ? 'still promotes' : 'rejects'} it `
       + `(corrected lo ${ev.wilsonFam.lo.toFixed(4)})`);
    if (old196 && !wantFam) removed++;
    if (old196 && wantFam) kept++;
  }
  ok(removed === 4 && kept === 2,
     `${removed} marginal records dropped, ${kept} genuine ones kept — the correction is not a blanket silencer`);
}

console.log('\n== the margin the card quotes is the margin that decided ==');
{
  const C = boot({ [FWD]: JSON.stringify(recs(30, 20, 2)) });
  const ev = C.hgOgSettledEvidence(ROW);
  const be = C.hgOgBreakevenHit(2);
  const mg = C.hgOgEdgeMargin(ev);
  ok(C.hgOgProvenEdgeOk(ev, 25, 0.02) === true, '20/30 at R=2 still proves an edge');
  ok(Math.abs(mg - (ev.wilsonFam.lo - be)) < 1e-12,
     `the quoted margin is measured off the corrected bound (${(mg * 100).toFixed(1)} pts)`);
  ok(Math.abs((ev.wilson.lo - be) - 0.1544) < 0.001,
     'not off the displayed one, which would have read 15.4 pts');
  ok(mg < ev.wilson.lo - be,
     'so the card now quotes the smaller, honest number rather than the flattering one');
}

console.log('\n== and the panels name the bar they test at ==');
{
  const C = boot();
  const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&sigma;/g, 'σ')
                              .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const exec = strip(C.hgOgSettledExecutePanelHtml({ proven: [], best: [] }));
  ok(/corrected for 78 mechanics/.test(exec), `the PROVEN EDGE panel says so: "${exec.slice(0, 150)}"`);
  ok(/\+3\.21σ/.test(exec), 'quoting the bar, not just claiming a correction');
  const verdict = strip(C.hgOgScalpVerdictPanelHtml({ go: null }));
  ok(/corrected for 78 mechanics/.test(verdict) && /\+3\.21σ/.test(verdict),
     'and so does the SCALP VERDICT panel');
  ok(!/NaN|undefined/.test(exec + verdict), 'neither printing NaN or undefined');

  /* the number is read from the family, so it cannot drift from it */
  const SRC = fs.readFileSync(path.join(ROOT, 'omnigold.js'), 'utf8');
  ok(!/\+3\.21.?sigma|\+3\.21σ/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')),
     'and 3.21 is not written into the page as a literal — it is computed from OG_MECHANICS.length');
}

console.log('\n' + passed + ' passed, 0 failed');
