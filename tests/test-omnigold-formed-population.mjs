/**
 * hg-v917 — the OMNIGOLD mechanic record, scoped to the gate-clear population.
 *
 * HG_OG_REPLAY_EVIDENCE.kinds is `perKind`: every firing of a detector across
 * the whole walk, priced at PAXG. The same committed evidence file carries
 * sequentialBake.formedByKind — the same mechanics scoped to what cleared the
 * 35-gate stack, with netR_xm already computed — and nothing read it.
 *
 * This guard does NOT trust the literals in omnigold.js. It re-derives every
 * gate-clear figure from scripts/omnigold-replay-evidence.json through
 * scripts/omnigold-formed-population.mjs and fails on drift.
 *
 * It also pins the two things that make this a correction rather than a
 * softening: the gate-clear record is WORSE for most kinds, and no promotion
 * or veto moves because of it.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { formedPopulation, repriceToXm, PAXG_RT_PCT, XM_RT_PCT, EVIDENCE }
  from '../scripts/omnigold-formed-population.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; } else { fail++; console.error('  FAIL ' + m); } };
const eq = (a, b, m) => ok(Object.is(a, b), m + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));

const src = readFileSync(join(ROOT, 'omnigold.js'), 'utf8');
const W = {};
const ctx = {
  window: W, self: W, globalThis: W, Math, Date, JSON, isFinite, parseFloat, parseInt,
  Array, Object, String, Number, setTimeout: () => 0, clearTimeout: () => {},
  console: { log(){}, warn(){}, error(){} },
  document: { getElementById: () => null, createElement: () => ({ style: {}, appendChild(){} }),
              addEventListener(){}, querySelector: () => null, querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem(){} },
  location: { href: '' }, fetch: () => Promise.reject(new Error('offline'))
};
vm.createContext(ctx);
try { vm.runInContext(src, ctx, { timeout: 30000 }); } catch (e) { /* guards its own env */ }

const EV = W.hgOgReplayEvidence;
ok(typeof EV === 'function', 'omnigold.js exports hgOgReplayEvidence');

const measured = formedPopulation();
const fbRaw = JSON.parse(readFileSync(EVIDENCE, 'utf8')).sequentialBake.formedByKind;

/* ---- 1. every gate-clear literal is re-derived from the evidence file ---- */
console.log('1. the gate-clear block on every row is re-derived');
let checked = 0;
for (const [kind, want] of Object.entries(measured.rows)){
  if (want.formedN === null) continue;
  const got = EV(kind);
  ok(got, kind + ' resolves through hgOgReplayEvidence');
  if (!got) continue;
  ok(got.formed, kind + ' carries a formed block (absent is what hid this)');
  if (!got.formed) continue;
  checked++;
  eq(got.formed.n, want.formedN, kind + ' formed.n');
  /* the baked n must be SETTLED, the denominator the rate and the mean are
     over, not the firing count - 43 of the 54 have the two differing */
  eq(got.formed.n, fbRaw[kind].settled, kind + ' formed.n is the SETTLED count');
  ok(Math.abs(got.formed.winRate - fbRaw[kind].wins / fbRaw[kind].settled) < 5e-5,
     kind + ' win rate is wins/settled, the same definition as the unscoped half');
  eq(got.formed.winRate, want.formedWr, kind + ' formed.winRate');
  eq(got.formed.netXm, want.formedNetXm, kind + ' formed.netXm');
  eq(got.formed.grossR, want.formedGross, kind + ' formed.grossR');
  /* the unscoped half must be untouched — this pack adds, it does not edit */
  eq(got.n, want.shownN, kind + ' unscoped n is unchanged');
  eq(got.avgNetR, want.shownNetPaxg, kind + ' unscoped net is unchanged and still PAXG');
}
eq(checked, 54, 'all 54 mechanics carry a re-derived gate-clear record');

/* ---- 2. the correction is UNFAVOURABLE, which is why it matters ---- */
console.log('2. the gate-clear record is worse, not softer');
const s = measured.summary;
eq(s.kinds, 54, '54 mechanics carry a replay row');
eq(s.withFormed, 54, 'all 54 have a gate-clear row in the same file');
eq(s.formedWorse, 42, 'gate-clear is WORSE than the re-priced line for 42');
eq(s.formedBetter, 11, 'and better for 11');
ok(s.formedWorse > s.formedBetter * 3, 'so the correction tightens the desk rather than loosening it');
eq(s.positiveShown, 12, '12 kinds read net-positive at XM as displayed');
eq(s.positiveFormed, 9, 'only 9 do on the gate-clear record');
eq(s.signDiffers, 7, '7 kinds differ in sign between the two');
/* the two worst gaps, named in the comment a reader will hit */
{
  const p = measured.rows['PIN-REJECT'], t = measured.rows['THREE-BAR'];
  ok(Math.abs(p.shownNetXm - (-0.208)) < 0.002, 'PIN-REJECT re-prices to -0.21R');
  ok(Math.abs(p.formedNetXm - (-0.940)) < 0.002, 'and its gate-clear record is -0.94R');
  ok(Math.abs(t.shownNetXm - (-0.237)) < 0.002, 'THREE-BAR re-prices to -0.24R');
  ok(Math.abs(t.formedNetXm - (-0.927)) < 0.002, 'and its gate-clear record is -0.93R');
  /* These figures appear in TWO comments — the evidence header and the render
     site. A bare includes() check is satisfied by either, so a stale copy
     hides behind its twin (the hg-v916 survivor, again). Count every
     occurrence and check them all against the derivation. */
  const everyCount = (re) => [...src.matchAll(re)].map((m) => Number(m[1]));
  {
    const worse = everyCount(/(\d+) of the 54 (?:the\s+)?(?:that record is WORSE|gate-clear record is WORSE)/g);
    eq(worse.length, 2, 'the worse-for-N figure is stated in both comments');
    ok(worse.every((n) => n === s.formedWorse),
       'and every copy is ' + s.formedWorse + ' — got ' + JSON.stringify(worse));
    const drop = [...src.matchAll(/from (\d+) kinds to (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    eq(drop.length, 2, 'the net-positive drop is stated in both comments');
    ok(drop.every(([a, b2]) => a === s.positiveShown && b2 === s.positiveFormed),
       'and every copy is ' + s.positiveShown + '->' + s.positiveFormed + ' — got ' + JSON.stringify(drop));
    const sign = everyCount(/and (\d+) change sign/g);
    eq(sign.length, 2, 'the sign-flip count is stated in both comments');
    ok(sign.every((n) => n === s.signDiffers), 'and every copy is ' + s.signDiffers);
  }
  for (const n of ['-0.21R', '-0.94R', '-0.24R', '-0.93R'])
    ok(src.includes(n), 'omnigold.js states ' + n);
}

/* ---- 2b. the line a reader actually sees ---- */
console.log('2b. hgOgReplayLineHtml renders the gate-clear record');
{
  const LINE = W.hgOgReplayLineHtml;
  ok(typeof LINE === 'function', 'omnigold.js exports hgOgReplayLineHtml');
  if (typeof LINE === 'function'){
    const h = String(LINE('PIN-REJECT') || '');
    ok(/og-replay-formed/.test(h), 'the gate-clear line is rendered');
    ok(/gate-clear:/.test(h), 'and labelled as the gate-clear record');
    ok(/-0\.94R at XM/.test(h), 'carrying PIN-REJECT\'s own -0.94R');
    ok(/n=138/.test(h), 'and its own SETTLED count, not its firing count');
    /* No venue preset in this env, so the line above carries no XM figure and
       the render must make NO comparative claim. The first cut said
       'better than the line above' here, comparing against nothing. */
    ok(!/better than|WORSE than|the same as/.test(h),
       'with no venue set there is nothing to compare to, so no comparison is claimed');
    ok(!/undefined|NaN/.test(h), 'and nothing leaks into the line');
    const b = String(LINE('MMOVE') || '');
    ok(/og-replay-formed/.test(b), 'a kind where gate-clear is better also renders');
    ok(/\+0\.06R at XM/.test(b), 'with its own positive figure');
    /* MMOVE fires 204 times and settles 177. The rate is over settles, so the
       count printed beside it must be 177 — printing 204 would misstate it. */
    ok(/n=177/.test(b), 'MMOVE prints its 177 settles, not its 204 firings');
    ok(!/n=204/.test(b), 'and never its firing count');
    /* and the comparison, when it CAN be made, tracks the numbers */
    ok(/fm\.netXm < shownXm \? 'WORSE than'/.test(src), 'worse renders WORSE');
    ok(/fm\.netXm > shownXm \? 'better than'/.test(src), 'better renders better');
    ok(/isFinite\(shownXm\)/.test(src), 'and it is guarded on there being a figure to compare');
    /* a mechanic under the bake's 40-settle bar has no record to render */
    const thin = String(LINE('POC-REVERT') || '');
    ok(!/og-replay-formed/.test(thin), 'a below-bar kind renders no gate-clear line');
  }
}

/* ---- 3. NOTHING is promoted or vetoed differently ---- */
console.log('3. no verdict moves on the corrected basis');
const ev = JSON.parse(readFileSync(EVIDENCE, 'utf8'));
const fb = ev.sequentialBake.formedByKind;
const wilsonLo = (wins, n, z) => {
  if (!(n > 0)) return NaN;
  const p = wins / n, d = 1 + z * z / n;
  return ((p + z * z / (2 * n)) / d) - (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
};
const ZN = 1.96, ZF = 3.209;  /* naive 95%, and the family bar the panel states */
function tiers(get){
  let family = 0, naive = 0, closest = null;
  for (const [k, v] of Object.entries(ev.perKind)){
    const g = get(k, v);
    if (!g || !(g.wr > 0)) continue;
    const R = (g.gross + 1 - g.wr) / g.wr;
    if (!(R > 0)) continue;
    const be = 1 / (1 + R), wins = Math.round(g.wr * g.n);
    const lo95 = wilsonLo(wins, g.n, ZN), loF = wilsonLo(wins, g.n, ZF);
    if (loF > be) family++; else if (lo95 > be) naive++;
    const margin = lo95 - be;
    if (!closest || margin > closest.margin) closest = { kind: k, margin };
  }
  return { family, naive, closest };
}
const shown = tiers((k, v) => ({ n: v.n, wr: v.winRate, gross: v.avgGrossR }));
const gclear = tiers((k) => fb[k] ? { n: fb[k].settled, wr: fb[k].winRate, gross: fb[k].grossR } : null);
eq(shown.family, 0, 'nothing reaches the family bar as displayed');
eq(gclear.family, 0, 'nothing reaches it on the gate-clear record either');
ok(shown.family === gclear.family, 'so promotion is unchanged — this pack moves no verdict');
eq(shown.naive, 1, 'exactly one kind clears the naive 95% bar as displayed');
eq(gclear.naive, 0, 'and none does on the gate-clear record');
eq(shown.closest.kind, 'P6-FAIL', 'the one is P6-FAIL');
eq(gclear.closest.kind, 'P6-FAIL', 'and it is still the closest on the corrected basis');
ok(shown.closest.margin > 0 && shown.closest.margin < 0.001,
   'it clears by +' + shown.closest.margin.toFixed(4) + ' — a hair, not an edge');
ok(gclear.closest.margin < 0, 'and misses by ' + gclear.closest.margin.toFixed(4) + ' once scoped');
ok(src.includes('P6-FAIL, over by +0.0005 and under by'), 'omnigold.js records exactly that');
ok(/NOTHING IS PROMOTED OR VETOED DIFFERENTLY/.test(src), 'and states the no-behaviour-change claim');

/* ---- 4. the re-pricing rule is the repo's, not a new one ---- */
console.log('4. the venue arithmetic is borrowed, not invented');
eq(PAXG_RT_PCT, 0.26, 'the replay round trip is the bake\'s own');
eq(XM_RT_PCT, 0.020, 'and the XM one is hgOgVenuePresetCost\'s');
{
  const cm = ev.sequentialBake.costModel;
  eq(cm.paxgRtFrac * 100, PAXG_RT_PCT, 'PAXG matches the evidence file costModel');
  eq(cm.xmRtFrac * 100, XM_RT_PCT, 'XM matches it too');
  /* cost scales linearly with the round trip; at equal cost nothing moves */
  eq(repriceToXm(0.5, 0.5), 0.5, 'a zero-cost row re-prices to itself');
  ok(repriceToXm(0, -1) > -1, 'a costly row is cheaper at XM');
  ok(Math.abs(repriceToXm(0.036, -0.834) - (-0.0310)) < 0.001, 'ROUND-MAGNET re-prices to -0.031R');
}

/* ---- 5. absent stays absent ---- */
console.log('5. no zero-fill anywhere');
eq(EV('NOT-A-MECHANIC'), null, 'an unknown kind resolves to null');
{
  const below = Object.keys(ev.sequentialBake.kindBelowThreshold.kinds);
  ok(below.length > 0, 'the bake names kinds under its 40-settle bar');
  for (const k of below){
    const got = EV(k);
    ok(!got || !got.formed, k + ' is under the bar and gets no gate-clear record');
  }
}
/* Every kind in THIS bake carries a gate-clear row, so the absent branch is
   unreachable from the real file — which means the real file cannot guard it.
   Exercise it on a fixture instead, or a zero-fill would ship untested. */
{
  const ev2 = JSON.parse(readFileSync(EVIDENCE, 'utf8'));
  const victim = 'ROUND-MAGNET';
  ok(ev2.sequentialBake.formedByKind[victim], 'the fixture starts with a gate-clear row');
  delete ev2.sequentialBake.formedByKind[victim];
  const dir = mkdtempSync(join(tmpdir(), 'hg-v917-'));
  const f = join(dir, 'evidence.json');
  try {
    writeFileSync(f, JSON.stringify(ev2));
    const r = formedPopulation(f);
    const row = r.rows[victim];
    ok(row, 'the kind still appears — it has an unscoped record');
    eq(row.formedN, null, 'but its gate-clear n is null, NOT 0');
    eq(row.formedNetXm, null, 'and its gate-clear net is null, not a flat 0.000R');
    eq(row.formedWr, null, 'and so is its win rate');
    eq(row.shownN, measured.rows[victim].shownN, 'while the unscoped half is untouched');
    eq(r.summary.withFormed, measured.summary.withFormed - 1, 'and the summary counts one fewer');
    ok(!Object.values(r.rows).some((x) => x.formedN === 0),
       'no kind is ever given a zero-filled gate-clear record');
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
/* a short row must yield null rather than reading undefined as a number */
ok(/row.length > 8/.test(src), 'the decoder length-checks before reading the formed block');
ok(/n here is SETTLED/.test(src),
   'and the decoder says which denominator its n is, where the next reader will look');
ok(/43 of the 54/.test(src), 'naming how many kinds have settles differing from firings');
ok(/Absent stays absent|absent stays absent/.test(src), 'and says so where a reader will look');

/* ---- 6. the vestigial constant ---- */
console.log('6. EDGE_VETO_SAMPLES is vestigial on this desk, and says so');
ok(/var EDGE_VETO_SAMPLES = 30;/.test(src), 'the value is untouched (gold-forward-read borrows it)');
{
  /* It is DECLARED and never READ here, and that is the whole point: exactly
     one occurrence in the file, and it is the declaration. Any second
     occurrence is either a read (the gate started using a bar it was never
     meant to) or a rename, and both deserve a look. */
  const occurrences = src.split('EDGE_VETO_SAMPLES').length - 1;
  eq(occurrences, 1, 'EDGE_VETO_SAMPLES occurs once in omnigold.js — its declaration, never a read');
  ok(/^\s*var EDGE_VETO_SAMPLES = 30;\s*$/m.test(src), 'and that one occurrence IS the declaration');
  ok(/VESTIGIAL ON THIS DESK/.test(src), 'and the comment says that plainly');
  /* the gate really does veto at MIN_SAMPLES */
  ok(/if \(sN < MIN_SAMPLES\)/.test(src), 'the gold gate judges against MIN_SAMPLES');
  ok(/var MIN_SAMPLES = 20;/.test(src), 'which is 20, per hg-v420');
}
{
  const route = readFileSync(join(ROOT, 'omniroute.js'), 'utf8');
  ok(/sN >= EDGE_VETO_SAMPLES/.test(route), 'the crypto twin genuinely reads it');
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : '') + pass + ' assertions passed');
if (fail) process.exit(1);
