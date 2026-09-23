/**
 * hg-v924 — when the cost ceiling is what emptied the scan, the desk says so.
 *
 * hg-v919 made the ceiling legible per plan and against the replay, but left
 * the case that matters silent: hgOgVenueCostNoteHtml renders only when the
 * venue DIFFERS from the replay's, and the replay is PAXG — so on the
 * fail-closed default the desk says nothing, which is exactly where the
 * ceiling does the most work (84.5% of all plans and 94.7% of the scalp lane
 * on the replay, against 13.0% / 16.6% at XM). A near-empty board then reads
 * as a quiet market rather than a venue setting.
 *
 * This guard pins the four things that keep the new note honest:
 *   1. it tallies THIS SCAN's ledger, not the replay;
 *   2. "dominant" is measured — cost-drag must be the TOP hard blocker;
 *   3. the counterfactual is scoped to SOLE-blocker plans, so "what a cheaper
 *      venue would buy" can never be read off plans that fail something else;
 *   4. it stays silent when anything ticketed, or when another gate leads.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));

const ctx = {
  Math, Date, JSON, isFinite, parseFloat, parseInt, Array, Object, String, Number,
  setTimeout: () => 0, clearTimeout: () => {},
  console: { log(){}, warn(){}, error(){} },
  document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
              addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem(){} },
  location: { href: '' }, fetch: () => Promise.reject(new Error('offline'))
};
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const OG_SRC = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
try { vm.runInContext(OG_SRC, ctx, { timeout: 30000 }); } catch (e) { /* guards its env */ }

const TALLY = ctx.hgOgCostCeilingScanTally;
const NOTE = ctx.hgOgCostCeilingScanNoteHtml;
const SETV = ctx.hgOgSetVenue;
const FUNNEL_EARLY = ctx.hgOgBlockerFunnelHtml;
for (const [f, n] of [[TALLY, 'hgOgCostCeilingScanTally'], [NOTE, 'hgOgCostCeilingScanNoteHtml'],
                      [SETV, 'hgOgSetVenue']])
  ok(typeof f === 'function', 'omnigold.js exports ' + n);

/* a plan row shaped like the scan's own candidates: horizon, plan, grade, gates */
const row = (o) => ({
  horizon: o.horizon || 'SCALP',
  plan: { entry: o.entry, stop: o.stop },
  grade: { ticket: !!o.ticket },
  gates: [
    { key: 'cost-drag', hard: true, pass: o.cost !== false },
    { key: 'confluence', hard: true, pass: o.conf !== false },
    { key: 'measured-edge', hard: true, pass: o.edge !== false },
    { key: 'a-soft-one', hard: false, pass: false }
  ]
});
/* 0.067% of entry — fails the scalp ceiling at BOTH venues (XM asks 0.133%) */
const tooTight = (o) => row(Object.assign({ entry: 4500, stop: 4497, cost: false }, o));
/* 0.200% — fails at PAXG (asks 1.733%), CLEARS at XM (asks 0.133%) */
const xmOnly = (o) => row(Object.assign({ entry: 4500, stop: 4491, cost: false }, o));
const fine = (o) => row(Object.assign({ entry: 4500, stop: 4400 }, o));

/* ---- 1. the tally reads this scan, and scopes the counterfactual ---- */
console.log('1. the tally counts this scan and scopes the counterfactual to sole blockers');
SETV('PAXG');
{
  const rows = [tooTight({}), xmOnly({}), xmOnly({ conf: false }), fine({})];
  const t = TALLY(rows);
  ok(t, 'a tally comes back');
  eq(t.venue, 'PAXG', 'at the venue in force');
  eq(t.priceable, 4, 'every row with a hard cost gate is priceable');
  eq(t.vetoed, 3, 'three failed the ceiling');
  /* the third also fails confluence, so it is NOT a ticket the venue withholds */
  eq(t.sole, 2, 'only two had the ceiling as their ONLY failing hard gate');
  eq(t.wouldClear, 1, 'and only one of those clears the same ceiling at XM');
  eq(t.otherVenue, 'XM', 'the counterfactual venue is named');
  ok(Math.abs(t.otherRt - 0.02) < 1e-9, 'and priced at the XM preset');
  eq(t.topKey, 'cost-drag', 'cost-drag is the top hard blocker here');
  eq(t.dominant, true, 'so the tally calls it dominant');
  eq(t.tickets, 0, 'and nothing ticketed');
  eq(t.px, 4500, 'the dollar reading aid is priced from this scan own plan entries');
}

/* ---- 2. dominance is measured, not assumed ---- */
console.log('2. another gate leading means the ceiling did not empty the scan');
{
  /* cost vetoes 1, confluence vetoes 3 — the ceiling is not the reason */
  const rows = [tooTight({}), fine({ conf: false }), fine({ conf: false }), fine({ conf: false })];
  const t = TALLY(rows);
  eq(t.topKey, 'confluence', 'confluence is the top blocker');
  eq(t.dominant, false, 'so cost-drag is not dominant');
  eq(NOTE(rows), '', 'and the note stays silent — it would be claiming the wrong cause');
}
{
  /* a tie does not count as dominant either: strictly more, or nothing */
  const rows = [tooTight({}), fine({ conf: false })];
  const t = TALLY(rows);
  ok(t.topN === 1, 'both gates blocked one plan each');
  eq(t.topKey, 'confluence', 'the tie breaks by name, so the answer is the same every render');
  eq(t.topTie, true, 'and the tie itself is flagged');
  eq(t.dominant, false, 'a tie is two causes, so nothing is dominant');
}
{
  /* THE TIE THAT MATTERS: one where cost-drag WINS the name tie-break.
     Without the topTie guard this reports the ceiling as the cause of a
     board two gates emptied equally — and the alphabetical winner would
     hide that from a test that only ever ties cost against confluence. */
  const rows = [tooTight({}), fine({ edge: false })];
  const t = TALLY(rows);
  eq(t.topKey, 'cost-drag', 'cost-drag wins this tie by name');
  eq(t.topTie, true, 'but it is still a tie');
  eq(t.dominant, false, 'so it is NOT dominant — the guard is what makes that true');
  const h = NOTE(rows);
  eq(h, '', 'and the venue paragraph does not run on a tie');
  ok(/no single binding gate/.test(FUNNEL_EARLY(rows)),
     'the funnel says so rather than crowning one of the two');
}

/* ---- 3. silent whenever the scan is not empty ---- */
console.log('3. a scan with a ticket is not an emptied scan');
{
  const rows = [tooTight({}), tooTight({}), fine({ ticket: true })];
  const t = TALLY(rows);
  eq(t.dominant, true, 'the ceiling is still the top blocker');
  eq(t.tickets, 1, 'but something ticketed');
  eq(NOTE(rows), '', 'so the note says nothing — the board is not empty');
}

/* ---- 4. it fires on PAXG, which is where the old note was silent ---- */
console.log('4. it fires on the fail-closed default, where hgOgVenueCostNoteHtml does not');
{
  const rows = [tooTight({}), xmOnly({}), tooTight({})];
  SETV('PAXG');
  const old = ctx.hgOgVenueCostNoteHtml();
  eq(old, '', 'the hg-v533 venue note is silent on PAXG — the gap this closes');
  const h = NOTE(rows);
  ok(h && h.length > 200, 'the new note renders');
  ok(/THE COST CEILING EMPTIED THIS SCAN/.test(h), 'and leads with the cause');
  ok(/not a quiet market/.test(h), 'saying explicitly what it is NOT');
  ok(/PAXG/.test(h), 'names the venue in force');
  ok(/XM/.test(h), 'and the one it is being compared against');
  ok(/only<\/b> failing hard gate/.test(h), 'scopes the claim to sole blockers');
  ok(/1\.733%/.test(h), 'prints what the ceiling asks of a chart at this venue');
  ok(/\$78\.00/.test(h), 'in dollars too, at the scan own price');
  ok(/0\.867%/.test(h), 'for the swing lane as well as the scalp one');
  ok(/fail-closed preset is the conservative one, not the wrong one/.test(h),
     'and does not tell the reader to switch venue to get more setups');
}

/* ---- 5. the sole-blocker sentence changes with the evidence ---- */
console.log('5. what it says about a cheaper venue tracks what the ledger supports');
{
  /* nothing is a sole blocker: a cheaper venue buys nothing, and it says so */
  const rows = [xmOnly({ conf: false }), xmOnly({ conf: false }), tooTight({ edge: false })];
  const h = NOTE(rows);
  ok(/would not have ticketed a single extra plan/.test(h),
     'with no sole blocker it says a cheaper venue buys nothing');
  ok(!/clear the same ceiling/.test(h), 'and makes no counterfactual claim at all');
}
{
  /* sole blockers exist but none clears elsewhere */
  const rows = [tooTight({}), tooTight({}), tooTight({})];
  const h = NOTE(rows);
  ok(/0<\/b> of them clear the same ceiling/.test(h), 'it reports zero clearing');
  ok(/the venue is not what is withholding them/.test(h), 'and says the venue is not the cause');
}
{
  /* and when some would clear, it says what that is worth and no more */
  const rows = [xmOnly({}), xmOnly({}), tooTight({})];
  const h = NOTE(rows);
  ok(/2<\/b> of them clear the same ceiling/.test(h), 'it reports how many would clear');
  ok(/still have to pass every other gate they already pass/.test(h),
     'and refuses to let that read as two tickets gained');
}

/* ---- 6. degenerate input is silence, never a throw ---- */
console.log('6. no ledger, no claim');
eq(TALLY([]), null, 'an empty scan has no tally');
eq(TALLY(null), null, 'and neither does a missing one, with no snapshot loaded');
eq(NOTE([]), '', 'the note is empty for an empty scan');
eq(NOTE(null), '', 'and for a missing one');
eq(TALLY([{ kind: 'X' }]), null, 'a row with no gate ledger is not priceable');
eq(NOTE([{ gates: [{ key: 'cost-drag', hard: false, pass: false }] }]), '',
   'a soft cost gate is not a ceiling veto');
{
  /* a plan the gate could not price at all must not be counted as passing */
  const noPlan = { horizon: 'SCALP', grade: { ticket: false },
                   gates: [{ key: 'cost-drag', hard: true, pass: false }] };
  const t = TALLY([noPlan, tooTight({})]);
  eq(t.priceable, 2, 'both carry a hard cost gate');
  eq(t.sole, 2, 'and both are sole blockers');
  eq(t.wouldClear, 0, 'but one has no levels to re-price, so it cannot be claimed as clearing');
  /* NO PRICE, NO DOLLARS — the price is the median entry of THIS scan's own
     plans, never a stand-in. A scan whose plans carry no levels has none. */
  const noneP = TALLY([noPlan, { horizon: 'SWING', grade: { ticket: false },
                                 gates: [{ key: 'cost-drag', hard: true, pass: false }] }]);
  eq(noneP.px, null, 'a scan with no plan levels reports no price');
  const h = NOTE([noPlan, noPlan]);
  ok(h && /THE COST CEILING EMPTIED THIS SCAN/.test(h), 'the note still renders');
  ok(!/\$/.test(h), 'but prints no dollar figure it would have had to invent');
  ok(/% of entry/.test(h), 'the percentage demand, which needs no price, is still there');
}

/* ---- 7. wired into the panel chain, after the hg-v919 ceiling panel ---- */
console.log('7. wired where a reader will meet it');
ok(/\+ hgOgBlockerFunnelHtml\(\)/.test(OG_SRC), 'the panel chain calls the funnel');
ok(/\+ hgOgCostCeilingPanelHtml\(\)[\s\S]{0,400}\+ hgOgBlockerFunnelHtml\(\)/.test(OG_SRC),
   'directly after the ceiling panel, which states the rule it is reporting on');
ok(/return h \+ hgOgCostCeilingScanNoteHtml\(rows, opts\);/.test(OG_SRC),
   'and the funnel folds the venue paragraph in, so the cost case is not a separate panel');
ok(/window\.hgOgCostCeilingScanTally = hgOgCostCeilingScanTally;/.test(OG_SRC), 'the tally is exported');
ok(/window\.hgOgCostCeilingScanNoteHtml = hgOgCostCeilingScanNoteHtml;/.test(OG_SRC), 'and the note');

/* ---- 8. nothing was gated on any of this ---- */
console.log('8. it reports; it does not gate');
ok(/var COST_VETO_R = 0\.30;/.test(OG_SRC), 'the swing ceiling is unchanged');
ok(/var COST_VETO_R_SCALP = 0\.15;/.test(OG_SRC), 'and the scalp ceiling');
ok(/var HG_OG_VENUE_UI_DEFAULT = 'XM';/.test(OG_SRC), 'the UI venue default is unchanged');
{
  const body = OG_SRC.slice(OG_SRC.indexOf('function hgOgCostCeilingScanTally'),
                            OG_SRC.indexOf('function hgOgCostCeilingPanelHtml'));
  ok(!/hgOgSetVenue|\.dropped|\.pass = |gates\.push/.test(body),
     'the new code sets no venue, drops nothing and writes no gate');
}

/* ---- 9. the general funnel: WHY NOTHING TICKETED, for any gate ---- */
console.log('9. the funnel names whatever gate is actually doing it');
const FUNNEL = ctx.hgOgBlockerFunnelHtml;
ok(typeof FUNNEL === 'function', 'omnigold.js exports hgOgBlockerFunnelHtml');
{
  /* the realistic case: measured-edge blocks everything, cost blocks one.
     GOLD SCALP has had this readout since gsRejectFunnelHTML; OMNIGOLD had
     none, so an empty board named no cause at all. */
  const rows = [tooTight({ edge: false }), fine({ edge: false }), fine({ edge: false, conf: false })];
  const h = FUNNEL(rows);
  ok(/WHY NOTHING TICKETED/.test(h), 'it renders the funnel');
  ok(/3 plans scanned/.test(h), 'counting this scan');
  ok(/binding gate: <b>measured-edge<\/b>/.test(h), 'and names the binding gate, not the cost one');
  ok(/measured-edge/.test(h) && /confluence/.test(h) && /cost-drag/.test(h),
     'with every hard blocker listed, not just the winner');
  ok(/add to more than 3/.test(h),
     'and says the counts overlap, so a reader cannot sum them into a plan count');
  /* the cost paragraph must NOT run when cost is not the binding gate */
  ok(!/THE COST CEILING EMPTIED THIS SCAN/.test(h),
     'the venue paragraph stays out when the ceiling is not the cause');
}
{
  /* and folds in when it IS the cause */
  const rows = [tooTight({}), xmOnly({}), tooTight({})];
  const h = FUNNEL(rows);
  ok(/WHY NOTHING TICKETED/.test(h), 'the funnel still leads');
  ok(/binding gate: <b>cost-drag<\/b>/.test(h), 'naming cost-drag');
  ok(/THE COST CEILING EMPTIED THIS SCAN/.test(h), 'and the venue paragraph follows it');
}
{
  /* a tie is two causes, and must not be reported as one */
  const rows = [tooTight({}), fine({ conf: false })];
  const t = TALLY(rows);
  eq(t.topTie, true, 'a tie is flagged');
  eq(t.dominant, false, 'so the ceiling is not called dominant');
  const h = FUNNEL(rows);
  ok(/no single binding gate/.test(h), 'and the funnel says there is no single binding gate');
  ok(!/THE COST CEILING EMPTIED THIS SCAN/.test(h), 'with no venue claim attached');
}
{
  /* the binding gate must be stable across renders, not object-key order */
  const rows = [tooTight({}), fine({ conf: false }), fine({ conf: false })];
  const a = TALLY(rows).topKey, b = TALLY(rows).topKey;
  eq(a, b, 'the binding gate is deterministic');
  eq(a, 'confluence', 'and it is the gate with strictly the most blocks');
}
eq(FUNNEL([]), '', 'an empty scan gets no funnel');
eq(FUNNEL(null), '', 'and neither does a missing one');
{
  const rows = [fine({ ticket: true }), tooTight({})];
  eq(FUNNEL(rows), '', 'nor does a scan that actually ticketed something');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
