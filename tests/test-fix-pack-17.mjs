/* HARDGATE — fix pack 17 tests.
   Covers: scalp family map, generic rollup, scalp verdict + blockers,
   measured family lift (incl. the per-gate over-counting bug it fixes),
   gate-state capture/sanitising, and the pack 16 denominator fix. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import assert from 'assert';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
let pass = 0;
function ok(cond, msg){
  assert.ok(cond, msg);
  pass++;
}
function eq(a, b, msg){
  assert.strictEqual(a, b, msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
  pass++;
}

/* ---------- load the pack 17 core in an isolated context ---------- */
function loadCore(file){
  const ctx = vm.createContext({ window: {}, console, Math, JSON, Date, isFinite, String, Object, Array, RegExp });
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx);
  return ctx.window;
}
const W = loadCore('fixpack17-core.js');
const W16 = loadCore('fixpack16-core.js');

/* ================= 1. family map integrity ================= */
const meta = W.hgScalpGateFamilies();
eq(Object.keys(meta).length, 20, 'all 20 scalp gates are mapped');

const famCounts = {};
for (const id of Object.keys(meta)){
  ok(/^C([1-9]|1[0-9]|20)$/.test(id), 'gate id is a real scalp gate: ' + id);
  ok(typeof meta[id].family === 'string' && meta[id].family, id + ' has a family');
  ok(['fast', 'medium', 'slow'].includes(meta[id].speed), id + ' has a valid speed');
  ok(typeof meta[id].label === 'string' && meta[id].label, id + ' has a label');
  famCounts[meta[id].family] = (famCounts[meta[id].family] || 0) + 1;
}
/* every C1..C20 present exactly once */
for (let i = 1; i <= 20; i++) ok(meta['C' + i], 'C' + i + ' is mapped');

const order = W.hgScalpFamilyOrder();
eq(order.length, 10, 'ten scalp families');
eq(Object.keys(famCounts).length, 10, 'family map yields exactly ten families');
for (const f of Object.keys(famCounts)) ok(order.includes(f), 'family in order list: ' + f);
/* the whole point of the pack: the seven collinear oscillators are one family */
eq(famCounts.oscillator, 7, 'all seven same-series oscillators land in one family');
eq(famCounts.structure, 3, 'structure holds C2/C3/C19');
eq(famCounts.trend, 3, 'trend holds C4/C6/C8');
let sum = 0;
for (const f of Object.keys(famCounts)) sum += famCounts[f];
eq(sum, 20, 'family member counts sum to 20 — no gate lost or double-counted');

/* ================= 2. rollup ================= */
function ledger(stateFor){
  return Object.keys(meta).map((id) => [id, meta[id].label, stateFor(id), 'detail ' + id]);
}
const allPass = ledger(() => 'pass');
let roll = W.hgScalpRollup(allPass);
eq(roll.length, 10, 'rollup produces ten families when all gates present');
for (const fam of roll) eq(fam.verdict, 'AGREE', fam.family + ' AGREE when every member passes');

const allVeto = ledger(() => 'veto');
for (const fam of W.hgScalpRollup(allVeto)) eq(fam.verdict, 'OPPOSE', fam.family + ' OPPOSE when every member vetoes');

const allNa = ledger(() => 'na');
for (const fam of W.hgScalpRollup(allNa)) eq(fam.verdict, 'DARK', fam.family + ' DARK when every member is n/a');

/* SPLIT + dissent naming */
const splitLed = ledger((id) => (id === 'C7' ? 'veto' : 'pass'));
const oscRow = W.hgScalpRollup(splitLed).find((f) => f.family === 'oscillator');
eq(oscRow.verdict, 'SPLIT', 'one dissenting oscillator makes the family SPLIT');
eq(oscRow.dissent.length, 1, 'exactly one dissenter identified');
eq(oscRow.dissent[0].id, 'C7', 'the dissenter is named');
ok(W.hgScalpDissentLine(oscRow).includes('C7'), 'dissent line names the flipping gate');
ok(W.hgScalpDissentLine(oscRow).includes('fast'), 'dissent line flags a fast-member flip');
eq(W.hgScalpDissentLine(W.hgScalpRollup(allPass)[0]), '', 'no dissent line for an AGREE family');

/* an unmapped gate must not invent a family or inflate the denominator */
const withJunk = allPass.concat([['ZZ9', 'not a real gate', 'pass', 'x']]);
const junkRoll = W.hgScalpRollup(withJunk);
eq(junkRoll.length, 10, 'unmapped gate does not create a family');
let junkMembers = 0;
for (const fam of junkRoll) for (const m of fam.members) if (m.id === 'ZZ9') junkMembers++;
eq(junkMembers, 0, 'unmapped gate never appears as a member of any family');
let totalMembers = 0;
for (const fam of junkRoll) totalMembers += fam.members.length;
eq(totalMembers, 20, 'unmapped gate does not inflate the member count');

/* n/a members are excluded from the pass denominator, not counted as failures */
const naMix = ledger((id) => (id === 'C7' ? 'na' : 'pass'));
const oscNa = W.hgScalpRollup(naMix).find((f) => f.family === 'oscillator');
eq(oscNa.verdict, 'AGREE', 'a family with an n/a member still AGREEs on the rest');
eq(oscNa.nNa, 1, 'n/a member counted separately');

/* ================= 3. verdict ================= */
let v = W.hgScalpVerdict(W.hgScalpRollup(allPass), { legacyScore: 100 });
eq(v.label, 'STRONG', 'all families agree -> STRONG');
eq(v.total, 10, 'denominator is the families actually present');
eq(v.agree, 10, 'ten agreeing families counted');
eq(v.legacyScore, 100, 'legacy score carried through for comparison');

/* THE CORE FIX: 7 collinear oscillators passing must not carry the read.
   Legacy scored this 12/20 = 60% = MODERATE. */
const passSet = new Set(['C1', 'C2', 'C3', 'C14', 'C20', 'C7', 'C9', 'C11', 'C12', 'C15', 'C16', 'C17']);
const oscOnly = ledger((id) => (passSet.has(id) ? 'pass' : 'veto'));
const legacyPct = (oscOnly.filter((r) => r[2] === 'pass').length / 20) * 100;
eq(Math.round(legacyPct), 60, 'legacy flat score for this ledger is 60%');
const vOsc = W.hgScalpVerdict(W.hgScalpRollup(oscOnly), { legacyScore: legacyPct });
eq(vOsc.label, 'WEAK', 'families demote a 60% oscillator-carried read to WEAK');
eq(vOsc.agree, 4, 'only four independent families actually agree');
ok(vOsc.why.includes('4 of 10'), 'verdict states the honest ratio');

/* blockers cannot be outvoted */
const c1Veto = ledger((id) => (id === 'C1' ? 'veto' : 'pass'));
let vT = W.hgScalpVerdict(W.hgScalpRollup(c1Veto), {});
eq(vT.label, 'TIMING VETO', 'kill-zone veto blocks despite 9 agreeing families');
eq(vT.tier, 'veto', 'timing veto is a veto tier');
ok(vT.blockers.includes('C1'), 'C1 named as the blocker');
ok(vT.timingVeto, 'timingVeto flag set');

const c14Veto = ledger((id) => (id === 'C14' ? 'veto' : 'pass'));
eq(W.hgScalpVerdict(W.hgScalpRollup(c14Veto), {}).label, 'TIMING VETO', 'event-window veto blocks');

const c20Veto = ledger((id) => (id === 'C20' ? 'veto' : 'pass'));
let vR = W.hgScalpVerdict(W.hgScalpRollup(c20Veto), {});
eq(vR.label, 'STRUCTURAL VETO', '2R-does-not-fit veto blocks');
ok(vR.structuralRrVeto, 'structuralRrVeto flag set');
ok(W.hgScalpVerdict(W.hgScalpRollup(allPass), { structuralRrVeto: true }).label === 'STRUCTURAL VETO',
  'caller-supplied structural veto also blocks');

/* premise outranks everything: no sweep/reclaim means no scalp exists */
const noSweep = ledger((id) => (id === 'C2' ? 'veto' : 'pass'));
let vP = W.hgScalpVerdict(W.hgScalpRollup(noSweep), {});
eq(vP.label, 'NO SETUP', 'missing sweep is NO SETUP, not a weaker score');
ok(vP.premiseMissing.includes('C2'), 'C2 named as the missing premise');
const noReclaim = ledger((id) => (id === 'C3' ? 'veto' : 'pass'));
eq(W.hgScalpVerdict(W.hgScalpRollup(noReclaim), {}).label, 'NO SETUP', 'missing reclaim is NO SETUP');
/* premise takes precedence over a timing blocker */
const bothBad = ledger((id) => (id === 'C2' || id === 'C1' ? 'veto' : 'pass'));
eq(W.hgScalpVerdict(W.hgScalpRollup(bothBad), {}).label, 'NO SETUP', 'premise reported before timing');

/* partial ledger: denominator must shrink, never stay at 10 */
const partial = [['C1', 'Kill zone', 'pass', ''], ['C2', 'Sweep', 'pass', ''], ['C3', 'Reclaim', 'pass', '']];
const vPart = W.hgScalpVerdict(W.hgScalpRollup(partial), {});
eq(vPart.total, 2, 'partial ledger reports only the families present');
ok(!vPart.why.includes('of 10'), 'partial ledger does not claim a 10-family denominator');
/* a thin ledger must never reach a conviction tier, however unanimous */
eq(vPart.label, 'WEAK', 'unanimous agreement over 2 families is capped at WEAK, not STRONG');
ok(vPart.why.includes('too thin'), 'thin-ledger read says why it is capped');
const FAMS6 = ['session', 'structure', 'trend', 'oscillator', 'flow', 'volregime'];
function ledgerForFamilies(list){
  const out = [];
  for (const f of list){
    for (const id of Object.keys(meta)) if (meta[id].family === f) out.push([id, id, 'pass', '']);
  }
  return out;
}
for (let n = 1; n <= 5; n++){
  const vv = W.hgScalpVerdict(W.hgScalpRollup(ledgerForFamilies(FAMS6.slice(0, n))), {});
  eq(vv.total, n, n + ' families resolved');
  ok(vv.label !== 'STRONG' && vv.label !== 'MODERATE',
    n + ' unanimous famil' + (n === 1 ? 'y' : 'ies') + ' cannot produce a conviction read (got ' + vv.label + ')');
}
/* six or more families restores the normal ladder */
const v6 = W.hgScalpVerdict(W.hgScalpRollup(ledgerForFamilies(FAMS6)), {});
eq(v6.total, 6, 'six families resolved');
eq(v6.label, 'STRONG', 'six unanimous families is a legitimate STRONG');

/* degenerate input never throws */
eq(W.hgScalpRollup(null).length, 0, 'null ledger yields no families');
eq(W.hgScalpRollup([]).length, 0, 'empty ledger yields no families');
eq(W.hgScalpVerdict([], {}).total, 0, 'empty rollup has zero denominator');
eq(W.hgScalpVerdict(null, {}).label, 'BIAS ONLY', 'null rollup degrades to BIAS ONLY, does not throw');

/* ================= 4. gate-state capture ================= */
const gs = W.hgGateStatesFromLedger(ledger((id) => (id === 'C7' ? 'na' : (id === 'C4' ? 'veto' : 'pass'))));
eq(gs.C4, 'veto', 'veto state captured');
eq(gs.C1, 'pass', 'pass state captured');
eq(gs.C7, undefined, "'na' omitted — absent and n/a are equivalent downstream");
eq(Object.keys(gs).length, 19, 'nineteen non-na gates captured');
eq(Object.keys(W.hgGateStatesFromLedger([])).length, 0, 'empty ledger captures nothing');
eq(Object.keys(W.hgGateStatesFromLedger(null)).length, 0, 'null ledger captures nothing');

/* ================= 5. measured family lift ================= */
function mkRecs(){
  /* trend agreement genuinely carries (+1.3R); oscillator agreement is noise */
  const recs = [];
  for (let i = 0; i < 24; i++){
    const trendAgree = i < 12;
    const oscAgree = i % 2 === 0;
    const st = {};
    for (const g of ['C4', 'C6', 'C8']) st[g] = trendAgree ? 'pass' : 'veto';
    for (const g of ['C7', 'C9', 'C11', 'C12', 'C15', 'C16', 'C17']) st[g] = oscAgree ? 'pass' : 'veto';
    recs.push({ status: 'settled', r: trendAgree ? 0.9 : -0.4, at: Date.now() - i * 864e5, gateStates: st });
  }
  return recs;
}
const recs = mkRecs();
const lift = W.hgFamilyLift(recs);
eq(lift.nSettled, 24, 'all settled records with gate states are used');
const trendLift = lift.familyLift.find((f) => f.family === 'trend');
const oscLift = lift.familyLift.find((f) => f.family === 'oscillator');
eq(trendLift.liftR, 1.3, 'trend family measures +1.30R lift');
eq(oscLift.liftR, 0, 'oscillator family correctly measures zero lift (it is noise)');
eq(trendLift.verdict, 'CARRIES', 'a real +1.3R edge over 12 samples CARRIES');
eq(oscLift.verdict, 'NEUTRAL', 'a zero-lift family is not promoted');

/* THE BUG THIS PORT FIXES: a family must be counted once per record, never
   once per gate. The 7-gate oscillator family and the 3-gate trend family saw
   the same 24 trades, so neither may claim more samples than that. */
eq(oscLift.nWith, 12, 'oscillator claims 12 record-level samples, not 7x12=84');
eq(trendLift.nWith, 12, 'trend claims 12 record-level samples, not 3x12=36');
ok(oscLift.nWith + oscLift.nWithout <= lift.nSettled,
  'a family can never report more samples than there are settled records');
for (const f of lift.familyLift){
  ok(f.nWith + f.nWithout <= lift.nSettled, f.family + ' sample count is bounded by the record count');
}

/* honest emptiness */
const empty = W.hgFamilyLift([]);
eq(empty.nSettled, 0, 'no records -> no samples');
eq(empty.familyLift[0].liftR, null, 'no samples -> null lift, never 0');
eq(empty.familyLift[0].verdict, 'UNPROVEN', 'no samples -> UNPROVEN');
ok(W.hgFamilyLiftLine(empty.familyLift[0]).includes('no settled samples'),
  'empty lift line says so plainly');
eq(W.hgFamilyLift(null).nSettled, 0, 'null records handled');
/* open trades must not be measured */
eq(W.hgFamilyLift([{ status: 'open', r: 5, gateStates: { C4: 'pass' } }]).nSettled, 0,
  'open trades are excluded from lift');
eq(W.hgFamilyLift([{ status: 'settled', r: null, gateStates: { C4: 'pass' } }]).nSettled, 0,
  'settled-but-null-R records are excluded');
eq(W.hgFamilyLift([{ status: 'settled', r: 1 }]).nSettled, 0,
  'records without gate states are excluded');
/* thin samples must not be promoted */
const thin = [];
for (let i = 0; i < 4; i++){
  thin.push({ status: 'settled', r: 3, at: Date.now(), gateStates: { C4: 'pass', C6: 'pass', C8: 'pass' } });
  thin.push({ status: 'settled', r: -1, at: Date.now(), gateStates: { C4: 'veto', C6: 'veto', C8: 'veto' } });
}
eq(W.hgFamilyLift(thin).familyLift.find((f) => f.family === 'trend').verdict, 'UNPROVEN',
  'a huge lift on 4 samples stays UNPROVEN');
/* 'na' must be EXCLUDED from a family's read on a record, never counted as a
   failure: a gate that could not be evaluated is not evidence against. */
const naRecs = [];
for (let i = 0; i < 14; i++){
  /* trend is all-na on these records, so trend must see zero samples */
  naRecs.push({ status: 'settled', r: i % 2 ? 1.5 : -1, at: Date.now() - i * 864e5,
    gateStates: { C4: 'na', C6: 'na', C8: 'na', C7: 'pass', C9: 'pass', C11: 'pass',
      C12: 'pass', C15: 'pass', C16: 'pass', C17: 'pass' } });
}
const naLift = W.hgFamilyLift(naRecs);
const naTrend = naLift.familyLift.find((f) => f.family === 'trend');
eq(naTrend.nWith, 0, "an all-na family reports no agreeing samples");
eq(naTrend.nWithout, 0, "an all-na family reports no disagreeing samples — 'na' is not a failure");
eq(naTrend.liftR, null, 'an all-na family has no measurable lift');
eq(naTrend.verdict, 'UNPROVEN', 'an all-na family stays UNPROVEN');
const naOsc = naLift.familyLift.find((f) => f.family === 'oscillator');
eq(naOsc.nWith, 14, 'the family that did resolve is measured normally');
/* mixed: a family where SOME members are na still reads off the rest */
const mixedNa = W.hgFamilyLift([{ status: 'settled', r: 1, at: Date.now(),
  gateStates: { C4: 'pass', C6: 'na', C8: 'na' } }]);
eq(mixedNa.familyLift.find((f) => f.family === 'trend').nWith, 1,
  'a family with one resolved pass and two na members counts as agreeing');

/* legacy field name still honoured */
eq(W.hgFamilyLift([{ status: 'settled', r: 1, at: Date.now(), deepGates: { C4: 'pass', C6: 'pass', C8: 'pass' } }]).nSettled, 1,
  'the older deepGates field is still read');

/* the swing meta from pack 16 can be measured without editing pack 16 */
const swingMeta = W16.hgGateFamilies();
ok(swingMeta && Object.keys(swingMeta).length > 20, 'pack 16 exposes its gate meta');
const swingLift = W.hgFamilyLift(
  [{ status: 'settled', r: 1, at: Date.now(), gateStates: { G1: 'pass', G19: 'veto' } }], swingMeta);
ok(swingLift.familyLift.length > 0, 'generic lift works against the swing family map');
eq(swingLift.nSettled, 1, 'swing lift counts the swing record');

/* lift map + render */
const map = W.hgFamilyLiftMap(lift);
eq(map.trend.liftR, 1.3, 'lift map keys by family');
const tbl = W.hgRenderFamilyLiftTable(lift, 'MEASURED');
ok(tbl.includes('MEASURED'), 'lift table renders its title');
ok(tbl.includes('TREND'), 'lift table lists families');
ok(tbl.includes('+1.30R'), 'lift table shows the signed lift');
ok(W.hgRenderFamilyLiftTable(empty, 'X').includes('Nothing measured yet'),
  'empty lift table explains itself instead of showing a misleading zero');
ok(W.hgRenderFamilyLiftTable(empty, 'X').includes('not because the families failed'),
  'empty state distinguishes no-data from failure');

/* render escapes hostile input rather than injecting it */
const eviltbl = W.hgRenderFamilyLiftTable({ familyLift: [{ family: 'x', label: '<img src=x onerror=alert(1)>', liftR: 1, nWith: 9, nWithout: 9, verdict: 'OK' }], nSettled: 18 }, '<script>');
ok(!eviltbl.includes('<img'), 'family label is escaped in the lift table');
ok(!eviltbl.includes('<script>'), 'title is escaped in the lift table');

const famHtml = W.hgRenderScalpFamilyLedger(W.hgScalpRollup(allPass), (id, n, s) => '<i>' + id + '</i>', map);
ok(famHtml.includes('hg-fam-row'), 'scalp family ledger uses the collapsible family row class');
ok(famHtml.includes('<details'), 'families render collapsed');
for (let i = 1; i <= 20; i++) ok(famHtml.includes('<i>C' + i + '</i>'), 'family ledger renders gate C' + i);

/* ================= 6. pack 16 denominator fix ================= */
const swingOrder = W16.hgFamilyOrder ? W16.hgFamilyOrder() : null;
/* full 12-family rollup must behave EXACTLY as before the fix */
function swingLedger(stateFor){
  return Object.keys(swingMeta).map((id) => [id, swingMeta[id].label || id, stateFor(id), '']);
}
const swingAllPass = swingLedger(() => 'pass');
const sRoll = W16.hgFamilyRollup(swingAllPass);
eq(sRoll.length, 12, 'swing rollup still yields 12 families when all gates present');
const sv = W16.hgFamilyVerdict(sRoll, {});
eq(sv.total, 12, 'full swing ledger still reports a denominator of 12');
eq(sv.label, 'STRONG', 'full agreement is still STRONG — thresholds unchanged at 12 families');

/* partial rollup: the old code claimed "of 12" against families that were absent */
const partialSwing = swingAllPass.filter((r) => ['trend', 'oscillator', 'flow'].includes(swingMeta[r[0]].family));
const pRoll = W16.hgFamilyRollup(partialSwing);
const pv = W16.hgFamilyVerdict(pRoll, {});
eq(pv.total, pRoll.length, 'partial swing rollup reports the real family count');
ok(pv.total < 12, 'partial rollup denominator is genuinely below 12');
ok(pv.why.includes('of ' + pRoll.length), 'partial swing verdict quotes the honest denominator');
ok(!pv.why.includes('of 12'), 'partial swing verdict no longer claims 12 families');
ok(pv.headline.includes('of ' + pRoll.length), 'partial swing headline quotes the honest denominator');

console.log('fix pack 17: ' + pass + ' assertions passed');
