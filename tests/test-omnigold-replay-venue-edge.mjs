/* HARDGATE — every mechanic, priced at the venue traded, judged against the
   fact that 54 of them were tested.

   WHAT THIS PINS, AND WHY IT MATTERS

   The replay measured 54 mechanics over 7,953 settled trades. Every one is
   net negative — but that net is PAXG-priced at 0.26% round trip, and this
   desk executes gold on XM at ~0.020%, thirteen times cheaper (see the
   venue-true cost model, hg-v533). hgOgReplayLineHtml quoted the PAXG net on
   every setup card whatever venue was selected, so each mechanic was labelled
   far worse than it is where SEND TICKET TO XM actually sends it.

   Re-pricing is arithmetic on numbers the record already carries:

     netAtVenue = avgGrossR - medianCostR x (venueRt / replayRt)

   At XM that turns 0 net-positive mechanics into 18 — which is exactly the
   point at which it becomes easy to fool yourself, so the verdict has to
   carry two more things:

     breakeven   the win rate the mechanic needs at its OWN payoff, 1/(1+R)
     family      54 mechanics were ranked; at a naive 95% bound ~2.7 clear by
                 chance with no edge at all, so "best of 54" needs a z set
                 for alpha/m, not 1.96

   Measured on the shipped table: ONE mechanic clears its own breakeven at the
   naive bound (fewer than chance alone would produce) and NONE clears
   family-wise. The honest headline is that re-pricing fixes a real labelling
   error and still does not produce a tradeable edge.

   Run: node tests/test-omnigold-replay-venue-edge.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const near = (a, b, eps) => Math.abs(a - b) <= eps;

function boot(venue){
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, isFinite, isNaN,
                parseFloat, parseInt, JSON, Array, Object, Number, String, Promise, RegExp,
                setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  /* NO STUB — hgWilson is in fixpack14-core.js, loaded below. The stub that
     stood here dropped the null guards the shipped function has, so these
     assertions ran against a more permissive estimator than the tab ships. */
  if (venue) ctx.HG_OG_VENUE = venue;
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js','hg-forward.js',
                   'plans.js','hg-gates.js','hg-plan.js','omniroute.js','omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

const XM = boot('XM');
const PAXG = boot('PAXG');
const TABLE = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/omnigold-replay-evidence.json'), 'utf8'));

console.log('== the inverse normal is accurate enough to set a family-wise bound ==');
{
  /* references from python statistics.NormalDist().inv_cdf — the tail branch
     is the one that matters here and Acklam holds it to ~3e-9 */
  ok(near(XM.hgOgInvNorm(0.975), 1.9599639845, 1e-8), 'z(0.975) = 1.9599639845');
  ok(near(XM.hgOgInvNorm(1 - 0.05 / (2 * 54)), 3.3121176663, 1e-8),
     'family-wise z for 54 tests = 3.3121176663 (tail branch, to 1e-8)');
  ok(near(XM.hgOgInvNorm(0.999), 3.0902323062, 1e-8), 'z(0.999) = 3.0902323062');
  ok(near(XM.hgOgInvNorm(0.5), 0, 1e-9), 'z(0.5) = 0');
  ok(!isFinite(XM.hgOgInvNorm(0)) || isNaN(XM.hgOgInvNorm(0)), 'p=0 is not a number');
  ok(isNaN(XM.hgOgInvNorm(1.5)), 'p out of range is NaN, never a silent 0');
}

console.log('\n== the family is counted, not assumed ==');
{
  const m = XM.hgOgReplayFamilySize();
  /* TESTS PERFORMED, which is what a family-wise correction is a function
     of. hg-v764 folded SPRING and UTAD and counted them as one; that fold
     is withdrawn, because the halves settle 19 points of win rate apart and
     a pooled record describes neither. Two records judged against two bars
     are TWO TESTS, so the count is the table size again — and the bar goes
     UP, which is the direction a correction should move when you admit to
     having made another comparison. */
  const rows = Object.keys(TABLE.perKind).length;
  ok(m === rows, `family size is every row that was tested (${m} of ${rows} rows)`);
  ok(m > 1, 'and it is a real family, not a single test');
  ok(XM.hgOgFamilyZ(m) > XM.hgOgFamilyZ(m - 1),
     'so un-pooling raises the bar rather than lowering it — one more test, not one fewer');
}

console.log('\n== the two halves of one detector are judged separately ==');
{
  /* The reason the fold is gone. These are the same function's two sides,
     and pooled they read 28.2% at z -1.28 — UNCHECKED for both, which
     ALSO lifted the veto the long half had earned on its own record. */
  const spring = XM.hgOgReplayEvidence('SPRING');
  const utad = XM.hgOgReplayEvidence('UTAD');
  ok(spring && utad, 'both labels carry their own row');
  ok(spring.n === 104 && utad.n === 91, `on separate samples (${spring.n} long, ${utad.n} short)`);
  ok(Math.abs(spring.winRate - utad.winRate) > 0.15,
     `and they are 19 points apart (${(100 * spring.winRate).toFixed(1)}% vs ${(100 * utad.winRate).toFixed(1)}%)`);
  ok(spring.n !== spring.n + utad.n, 'so neither reads the pooled 195-trade record');

  /* THE Z THE TAB ACTUALLY COMPUTES, not one this file re-derives. The
     earlier version built its own on the RAW row count and asserted the
     long half was "condemned" at -3.05σ — a verdict hg-v818 stopped
     reaching, because the replay overlaps and -3.05 raw is -1.94 effective.
     It went on passing because it never asked the code. */
  const BE = 1 / 3;
  const z = k => XM.hgOgReplayZ(XM.HG_OG_REPLAY_EVIDENCE.kinds[k], BE);
  ok(z('SPRING') < z('UTAD'),
     `the long half still measures worse than the short (${z('SPRING').toFixed(2)} vs ${z('UTAD').toFixed(2)})`);
  ok(z('SPRING') > -2,
     'but on the effective sample it is NOT condemned outright — 104 overlapping rows do not carry that');
  ok(XM.hgOgKindDemotion('SPRING', XM.hgOgVenuePresetCost('PAXG')),
     'it is stood aside anyway, on its measured gross rather than on a sigma');
  ok(z('UTAD') < XM.hgOgFamilyZ(XM.HG_OG_MECHANIC_COUNT),
     'and neither half comes near the bar to be a ticket — this buys nothing');

  /* THE BAR THE PANEL SHOWS IS THE BAR PROMOTION APPLIES. Until hg-v819
     hgOgReplayEdgeVerdict rolled its own — Bonferroni, two-sided, over the
     54 kinds with a record (+3.31σ) — while every display quoted Sidak,
     one-sided, over the 77 scanned (+3.21σ). Nothing pinned it, so the
     two could disagree indefinitely. */
  const verdict = XM.hgOgReplayEdgeVerdict(XM.hgOgReplayEvidence('P6-FAIL'));
  ok(verdict, 'the promotion verdict computes');
  ok(verdict.family === XM.HG_OG_MECHANIC_COUNT,
     'it corrects for every mechanic SCANNED (' + verdict.family + '), like the panel');
  ok(Math.abs(verdict.zFw - XM.hgOgFamilyZ(verdict.family)) < 1e-12,
     'using hgOgFamilyZ, not a second correction of its own');
  const displayed = Number((/\+(\d\.\d\d)&sigma;|\+(\d\.\d\d)σ/
    .exec(String(XM.hgOgEdgeProofPanelHtml())) || []).slice(1).filter(Boolean)[0]);
  ok(Math.abs(displayed - verdict.zFw) < 0.005,
     'and it is the same bar the empty-ticket panel prints (' + displayed + 'σ)');

  /* and the card shows the other half rather than leaving a reader with
     one side of a two-sided measurement */
  const line = XM.hgOgReplayLineHtml('SPRING');
  ok(/same detector, other side/.test(line), 'the SPRING card names its own other half');
  ok(/UTAD/.test(line), 'by label');
  ok(/not established/.test(line), 'and says the gap is not established');
  ok(XM.hgOgDirSibling('MMOVE') === null, 'a mechanic with no direction twin gets no such line');
  ok(!/same detector/.test(XM.hgOgReplayLineHtml('MMOVE')), 'and its card does not grow one');
}

console.log('\n== a mechanic that was never measured says so ==');
{
  /* 13 mechanics fire on this walk and settle too few times to carry a
     record. The bake omits them, correctly — but the card then rendered
     NOTHING, which reads exactly like a mechanic that was measured and came
     back fine. */
  const below = XM.hgOgReplayLineHtml('POC-REVERT');
  ok(below !== '', 'an unmeasured mechanic no longer renders as silence');
  ok(/NOT MEASURED/.test(below), 'it says so in as many words');
  ok(/2 settled firing/.test(below), 'with the count it actually reached');
  ok(/40/.test(below), 'and the bar it fell short of');
  ok(!/%/.test(below), 'and NO win rate — a rate on two trades is the same overclaim with a caveat');
  ok(!/NaN|undefined|null/.test(below), 'with nothing leaked');

  ok(XM.hgOgReplayLineHtml('NOT-A-MECHANIC') === '',
     'while an unknown key still renders nothing — it is not a mechanic and has nothing to disclose');
}

console.log('\n== re-pricing uses the record\'s own numbers ==');
{
  const ev = XM.hgOgReplayEvidence('MMOVE');
  ok(ev && ev.n === 206, 'MMOVE record loads (n=206)');
  const rp = XM.hgOgReplayNetAtVenue(ev);
  ok(rp && rp.repriced, 'XM re-prices the PAXG record');
  /* THIS ASSERTION USED TO RE-DERIVE THE IMPLEMENTATION'S OWN EXPRESSION —
     `expect = avgGrossR - medianCostR * ratio`, compared against the code
     that computes exactly that. It could only fail if the code and the test
     drifted apart; it could never catch the formula being WRONG, and it
     did not: subtracting a MEDIAN cost from a MEAN gross meant the thing
     failed to reproduce the record it re-prices, on 53 of 54 kinds.

     The property below cannot be satisfied by a wrong formula. Priced at
     the replay's OWN cost, a re-pricing must return the replay's OWN
     measured net — the ratio is 1 and there is nothing left to scale. */
  const rpP = PAXG.hgOgReplayNetAtVenue(PAXG.hgOgReplayEvidence('MMOVE'));
  ok(rpP && rpP.repriced === false, 'at PAXG the record is already priced right — nothing to restate');
  ok(near(rpP.net, ev.avgNetR, 1e-9),
     'and re-pricing it AT the replay cost returns the measured net exactly');

  /* every kind, not one */
  const E = PAXG.HG_OG_REPLAY_EVIDENCE;
  const offenders = Object.keys(E.kinds).filter(k => {
    const r = PAXG.hgOgReplayNetAtVenue(PAXG.hgOgReplayEvidence(k));
    return !r || !near(r.net, E.kinds[k][2], 1e-9);
  });
  ok(offenders.length === 0,
     'the identity holds for all ' + Object.keys(E.kinds).length
     + ' baked kinds (' + offenders.length + ' off)');

  /* and the mean fee it now subtracts is the one the bake implies */
  ok(near(XM.hgOgVenueNet(ev.avgGrossR, ev.avgNetR, 0.26, 0.26), ev.avgNetR, 1e-9),
     'hgOgVenueNet collapses to the measured net at the replay cost');
  ok(near(XM.hgOgVenueNet(ev.avgGrossR, ev.avgNetR, 0, 0.26), ev.avgGrossR, 1e-9),
     'and to the gross at a venue that charges nothing');
  ok(rp.net > ev.avgNetR, 'a cheaper venue cannot make the same record worse');
  ok(rp.net < ev.avgGrossR, 'nor better than free');
}

console.log('\n== a record with no gross is not re-priced into existence ==');
{
  /* engine grades and score tiers carry no avgGrossR — inventing one would
     put a fabricated number on a card */
  const grade = XM.hgOgReplayEvidence('A');
  ok(grade && grade.avgGrossR === null, 'the grade-A record genuinely has no gross');
  ok(XM.hgOgReplayNetAtVenue(grade) === null, 'so it is not re-priced');
  ok(XM.hgOgReplayEdgeVerdict(grade) === null, 'and gets no edge verdict');
  ok(XM.hgOgReplayNetAtVenue(null) === null, 'a missing record is null, never a throw');
}

console.log('\n== the verdict answers breakeven AND selection ==');
{
  const ev = XM.hgOgReplayEvidence('P6-FAIL');
  const vd = XM.hgOgReplayEdgeVerdict(ev);
  ok(vd, 'P6-FAIL gets a verdict');
  ok(vd.loFw < vd.lo95, 'the family-wise bound is strictly tighter than the naive one');
  ok(near(vd.breakeven, 1 / (1 + vd.impliedR), 1e-12), 'breakeven is 1/(1+R) at the implied payoff');
  ok(vd.tier !== 'family', 'and even the best mechanic does not clear family-wise');
}

console.log('\n== sweeping all 54: re-pricing helps, and still finds no edge ==');
{
  let repriced = 0, netPosXM = 0, netPosPaxg = 0, naive = 0, family = 0;
  /* EVERY ROW, because every row is a record that was measured and judged.
     hg-v764 walked this table folding SPRING and UTAD into one entry; that
     fold is withdrawn. Their halves disagree by 19 points of win rate,
     which v764 read as a reason to pool and is in fact the reason not to —
     a pooled record describes neither side. */
  for (const kind of Object.keys(TABLE.perKind)){
    const ev = XM.hgOgReplayEvidence(kind);
    if (!ev) continue;
    if (ev.avgNetR > 0) netPosPaxg++;
    const rp = XM.hgOgReplayNetAtVenue(ev);
    if (rp){ repriced++; if (rp.net > 0) netPosXM++; }
    const vd = XM.hgOgReplayEdgeVerdict(ev);
    if (vd && vd.tier === 'naive') naive++;
    if (vd && vd.tier === 'family') family++;
  }
  ok(repriced === 54, `all 54 rows re-price (${repriced}) — every measured record is one`);
  ok(netPosPaxg === 0, 'at the replay\'s PAXG cost, NOTHING is net positive');
  /* 17 -> 18, back where it was before hg-v764 pooled the pair. UTAD reads
     net positive at XM and SPRING does not, and that is a FACT ABOUT THE
     TWO SIDES rather than a labelling error: pooling hid it by averaging a
     19-point gap into a midpoint neither half occupies. The number moving
     back up is not the veto weakening — nothing here clears breakeven, let
     alone the family bar, and the assertions below still say so. */
  /* hg-v817: 18 -> 12. Not the veto weakening and not the pooling change —
     the re-pricing stopped subtracting a MEDIAN fee from a MEAN gross, and
     six of the eighteen only cleared zero because the fee was understated.
     Being too generous about the venue this desk actually trades is the
     direction that would not have been questioned. */
  ok(netPosXM === 12, `at XM cost, 12 are net positive (${netPosXM}) — six fewer than the median-fee arithmetic claimed`);
  /* WAS 1, IS NOW 0, and the change is the point rather than a regression.
     hgOgReplayEdgeVerdict used to read n replay rows as n independent
     trades. The walk that produced them published 59.4 plans a day on one
     instrument and held a time-weighted mean of 55 positions at once, so
     the row count was never the sample size. Deflated to the measured
     effective sample (hgOgEffN, week-clustered: 3,111 of 7,670), the one
     mechanic that used to clear its own breakeven at naive 95% no longer
     does — it was clearing on an interval that was too narrow.

     The test's own thesis gets stronger, not weaker: 0 is further below
     the ~2.7 that chance alone yields than 1 was. */
  ok(naive === 0, `and NONE clears its own breakeven at 95% (${naive})`);
  ok(naive < 54 * 0.05, 'which is FEWER than the ~2.7 chance alone would produce');
  ok(family === 0, 'and none survives the family-wise bound — no mechanic has a provable edge');
}

console.log('\n== the card states all of it ==');
{
  const html = XM.hgOgReplayLineHtml('MMOVE');
  ok(/replay:/.test(html), 'the card still shows the replay record');
  ok(/at XM/.test(html), 'and what it costs at the venue actually traded');
  ok(/breakeven/.test(html), 'and the breakeven it has to clear');
  ok(/by chance|no measured edge|edge holds/.test(html), 'and an honest verdict');
  ok(!/NaN|undefined|null/.test(html), 'with nothing leaked');

  const none = XM.hgOgReplayLineHtml('NOT-A-MECHANIC');
  ok(none === '', 'an unknown mechanic renders nothing at all');
}

console.log('\nomnigold replay venue + edge: ' + passed + ' checks passed');
