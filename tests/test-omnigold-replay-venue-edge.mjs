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
  ctx.hgWilson = (wins, n, z) => {
    z = z || 1.96; const p = wins / n, z2 = z * z;
    const denom = 1 + z2 / n;
    const centre = (p + z2 / (2 * n)) / denom;
    const half = (z / denom) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n));
    return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), p: p };
  };
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
  ok(m === Object.keys(TABLE.perKind).length, `family size is the table size (${m})`);
  ok(m > 1, 'and it is a real family, not a single test');
}

console.log('\n== re-pricing uses the record\'s own numbers ==');
{
  const ev = XM.hgOgReplayEvidence('MMOVE');
  ok(ev && ev.n === 206, 'MMOVE record loads (n=206)');
  const rp = XM.hgOgReplayNetAtVenue(ev);
  ok(rp && rp.repriced, 'XM re-prices the PAXG record');
  /* gross 0.088, cost 0.233, scale 0.020/0.26 -> 0.088 - 0.0179 = 0.0701 */
  const expect = ev.avgGrossR - ev.medianCostR * (rp.venueRt / rp.replayRt);
  ok(near(rp.net, expect, 1e-12), 'net = gross - cost x (venueRt/replayRt)');
  ok(rp.net > ev.avgNetR, 'a cheaper venue cannot make the same record worse');

  const rpP = PAXG.hgOgReplayNetAtVenue(PAXG.hgOgReplayEvidence('MMOVE'));
  ok(rpP && rpP.repriced === false, 'at PAXG the record is already priced right — nothing to restate');
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
  ok(repriced === 54, `all 54 mechanics re-price (${repriced})`);
  ok(netPosPaxg === 0, 'at the replay\'s PAXG cost, NOTHING is net positive');
  ok(netPosXM === 18, `at XM cost, 18 are net positive (${netPosXM}) — the labelling error was real`);
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
