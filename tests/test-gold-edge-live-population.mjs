/**
 * hg-v916 — the applied edge table, measured on the population the desk forms.
 *
 * Every n / gross / net on HG_GOLD_SETUP_EDGE.scalp is the whole main book of
 * scripts/backtest-goldscalp-results-floor.json. Since that replay was walked,
 * two gates have shipped that keep 45% of it off the desk, so the figure a
 * card quotes describes a population and not this desk.
 *
 * This guard does NOT trust the literals in goldind.js. It re-derives every
 * one of them from the replay through scripts/edge-live-population.mjs and
 * fails on drift, so a re-bake cannot leave the table quietly stale again.
 *
 * It also pins the two verdict flips that were REFUSED, because the in-sample
 * read invites them and a later reader will find the same invitation.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { liveEdgePopulation, liveSwingPopulation, COST_BAR_PCT, SUPPRESSED, SPLITS, MIN_SIDE,
         precursorOnly, QUALITY_STAMP, REPLAY, SWING_REPLAY,
         SWING_KEY_ALIAS } from '../scripts/edge-live-population.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond){ pass++; } else { fail++; console.error('  FAIL ' + msg); } };
const eq = (a, b, msg) => ok(Object.is(a, b), msg + ' — got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b));

/* ---- load the real table out of goldind.js, no stubbed copy ---- */
const src = readFileSync(join(ROOT, 'goldind.js'), 'utf8');
const W = {};
const ctx = vm.createContext({ window: W, self: W, globalThis: W, console, Math, Date, JSON, isFinite, parseFloat, parseInt, Array, Object, String, Number });
try { vm.runInContext(src, ctx, { timeout: 20000 }); } catch (e) { /* the module guards its own env */ }
const TABLE = W.HG_GOLD_SETUP_EDGE;
const NOTE = W.hgGoldEdgeLiveNote;
const APPLY = W.hgGoldSetupEdgeApply;
ok(TABLE && TABLE.scalp, 'goldind.js exports HG_GOLD_SETUP_EDGE');
ok(typeof NOTE === 'function', 'goldind.js exports hgGoldEdgeLiveNote');
ok(typeof APPLY === 'function', 'goldind.js exports hgGoldSetupEdgeApply');

const measured = liveEdgePopulation();

/* ---- 0. the precursor-only derivation, on the replay it reads ---- */
console.log('0. precursor-only is measured from the quality stamps, not annotated');
{
  const raw = JSON.parse(readFileSync(REPLAY, 'utf8'));
  const flagged = Object.entries(measured.rows).filter(([, v]) => v.precursorOnly).map(([k]) => k);
  /* hg-v1439 re-derivation: the hg-v1439 walk's stamp set no longer carries
     the Q?/10 marker for sweepob (its 34 rows stamp the S56/S60 conference
     reads instead), so NO kind is precursor-only on this replay — the flag
     correctly dropped itself, which is the behavior the derivation was built
     for. The derivation's own semantics stay pinned below. */
  eq(flagged.length, 0, 'no kind is precursor-only on the hg-v1439 replay (the flag dropped itself)');
  const sw = raw.trades.filter((t) => t.stratKey === 'sweepob');
  const stamp = (t) => (t.stamps || []).find((x) => QUALITY_STAMP.test(x)) || '';
  ok(sw.length > 0, 'sweepob still settles on the replay (' + sw.length + ' rows)');
  eq(sw.filter((t) => stamp(t)).length, 0, 'and none of them carries a quality stamp at all on this walk');
  /* both conditions matter: a kind that stamps NO quality has said nothing
     either way and must not be flagged */
  ok(!precursorOnly(raw.trades.filter((t) => t.stratKey === 'hvn')),
     'a kind that stamps no quality at all is not flagged');
  ok(!precursorOnly([]), 'and an empty set is not flagged');
  ok(precursorOnly([{ stamps: ['FOO Q?/10'] }]), 'a single all-unscored row is');
  ok(!precursorOnly([{ stamps: ['FOO Q?/10'] }, { stamps: ['FOO Q7/10'] }]),
     'but one scored firing is enough to clear the flag — which is how a re-bake drops it');
}

/* ---- 1. every literal matches what the replay says, right now ---- */
console.log('1. the live block on every row is re-derived from the replay');
const scalp = TABLE.scalp || {};
let checked = 0;
for (const [key, row] of Object.entries(scalp)){
  ok('live' in row, key + ' carries a live block (absent is not an option — it hid the staleness)');
  const want = measured.rows[key];
  if (!want){
    /* only a kind with no non-shadow settle may be null */
    eq(row.live, null, key + ' has no live population in the replay, so live is null');
    continue;
  }
  const got = row.live;
  ok(got && typeof got === 'object', key + ' live is an object');
  if (!got) continue;
  checked++;
  eq(got.n, want.n, key + ' live.n');
  eq(got.net, want.net, key + ' live.net');
  eq(got.oosHeld, want.oosHeld, key + ' live.oosHeld');
  /* hg-v923: precursorOnly is derived from the replay's own quality stamps,
     so it is re-derived here like every other field rather than trusted. */
  eq(!!got.precursorOnly, !!want.precursorOnly, key + ' live.precursorOnly');
  eq(got.oosBroke, want.oosBroke, key + ' live.oosBroke');
  eq(!!got.formsNone, !!want.formsNone, key + ' live.formsNone');
}
ok(checked >= 20, 're-derived at least 20 rows (got ' + checked + ')');
/* the four suppressed-after-the-walk kinds must be flagged, or the note lies
   about the desk forming them */
for (const k of SUPPRESSED){
  /* hg-v928 retuned nyexh and liqsweep OFF suppress on instruction, so the
     claim is now about the BAKED verdict — which is what SUPPRESSED, and this
     whole file's live/formsNone arithmetic, is derived from. */
  const bakedAct = (typeof scalp[k].actionBaked === 'string') ? scalp[k].actionBaked : scalp[k].action;
  ok(scalp[k] && bakedAct === 'suppress', k + ' is still a suppress row in the bake');
  ok(scalp[k] && scalp[k].live && scalp[k].live.formsNone === true, k + ' live is flagged formsNone');
}
/* fvg / vwapband were shadowed at walk time — no population, and none invented */
for (const k of ['fvg', 'vwapband']){
  eq(scalp[k].live, null, k + ' was shadowed at walk time, so live is null');
  ok(!measured.rows[k], k + ' has no non-shadow settle in the replay');
}

/* ---- 2. the headline the table cites ---- */
console.log('2. the book figure, as quoted and as the desk forms it');
/* hg-v1439 re-derivation: the hg-v1439 walk (Aug21–Oct22, post ceiling-reject)
   settles a 1,384-trade main book, and shadows the still-suppressed kinds
   (vwap 153, sweep 80) — the withheld population is measured on that ledger.
   The quoted figure (1,617) is main + withheld; the desk forms 1,278. */
const b = measured.book;
eq(b.quoted.n, 1617, 'the quoted book is 1617 settled (main 1384 + withheld ledger 233)');
eq(b.quoted.net, -0.061, 'the quoted book is -0.061R');
eq(b.today.n, 1278, 'the desk forms 1278 of them');
eq(b.today.net, -0.027, 'as formed, the book is -0.027R');
eq(b.noLongerFormed, 339, '339 are no longer formed');
eq(b.droppedByCost, 80, '80 under the cost reject (all inside the withheld ledger — the floor+ceiling era binds every main-book stop)');
eq(b.droppedBySuppress, 339, '339 from suppressed kinds');
eq(b.droppedByBoth, 80, '80 are both');
eq(b.droppedByCost + b.droppedBySuppress - b.droppedByBoth, b.noLongerFormed, 'the union arithmetic closes');
ok(Math.round(b.noLongerFormed / b.quoted.n * 100) === 21, 'that is 21% of the quoted book');
/* The five-line ladder in the cost-gate comment is the thing a reader will
   actually quote back. Check each line against the derivation rather than
   grepping for a substring that also appears in the table header — a stale
   figure in one of the two comments must not hide behind the other. */
const LADDER = [
  [/quoted everywhere\s+n=(\d+)\s+([-+][\d.]+)R/,      1384, -0.035],
  [/minus the four suppressed kinds\s+n=(\d+)\s+([-+][\d.]+)R/, 1278, -0.027],
  [/minus this cost reject only\s+n=(\d+)\s+([-+][\d.]+)R/,     1384, -0.035],
  [/what the desk forms\s+n=(\d+)\s+([-+][\d.]+)R/,             1278, -0.027],
  [/BEFORE venue cost\s+n=(\d+)\s+([-+][\d.]+)R/,               1278, +0.050]
];
const raw = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-goldscalp-results-floor.json'), 'utf8'));
const mainBook = raw.trades.filter((t) => typeof t.netR === 'number' && !t.shadow);
const stopPctOf = (t) => (typeof t.entry === 'number' && typeof t.stop === 'number' && t.entry > 0)
  ? Math.abs(t.entry - t.stop) / t.entry * 100 : 0;
const cohorts = [
  mainBook,
  mainBook.filter((t) => !SUPPRESSED.includes(t.stratKey)),
  mainBook.filter((t) => stopPctOf(t) >= COST_BAR_PCT),
  mainBook.filter((t) => stopPctOf(t) >= COST_BAR_PCT && !SUPPRESSED.includes(t.stratKey)),
  mainBook.filter((t) => stopPctOf(t) >= COST_BAR_PCT && !SUPPRESSED.includes(t.stratKey))
];
LADDER.forEach(([re, wantN, wantR], i) => {
  const m = src.match(re);
  ok(!!m, 'the cost-gate comment carries ladder line ' + (i + 1));
  if (!m) return;
  const rows = cohorts[i];
  const vals = rows.map((t) => (i === 4 ? t.rGross : t.netR));
  const avg = vals.reduce((a, x) => a + x, 0) / vals.length;
  eq(Number(m[1]), rows.length, 'ladder line ' + (i + 1) + ' n matches the replay');
  eq(Number(m[1]), wantN, 'ladder line ' + (i + 1) + ' n is the pinned value');
  eq(Number(m[2]), Math.round(avg * 1000) / 1000, 'ladder line ' + (i + 1) + ' R matches the replay');
  eq(Number(m[2]), wantR, 'ladder line ' + (i + 1) + ' R is the pinned value');
});
for (const n of ['1,384', '339', '1,617', '80', '21%']){
  ok(src.includes(n), 'goldind.js states ' + n);
}

/* ---- 3. NOT ONE ACTION CHANGED ---- */
console.log('3. no verdict moved on the live read');
const ACTIONS = {
  fvg: 'suppress', vwapband: 'suppress', vwap: 'suppress', nyexh: 'suppress',
  liqsweep: 'suppress', sweep: 'suppress', hvn: 'demote', ob: 'demote',
  openrange: 'demote', bosalign: 'demote', asian: 'demote', ribbon: 'demote',
  rsidiv: 'demote', p4laf: 'demote', silverb: 'demote', p6fail: 'prefer',
  p9volbar: 'demote', p5drive: 'demote', p6comp: 'demote', sweepob: 'neutral',
  p8range: 'neutral', p5vwap: 'neutral', p5wyck: 'neutral', p8vpinbo: 'demote',
  p7scalp: 'neutral', vpbook: 'neutral', adrfade: 'neutral'
};
/* hg-v1439: two baked verdicts MOVED on the live read — p9volbar prefer→demote
   (prefer measured dead on three fresh reads: −0.226/−0.231/−0.267R) and
   p8vpinbo neutral→demote (−0.249R, negative both halves, n=10) — pinned here
   as the new in-force state, with the rest of the map unchanged. */
/* The BAKED verdict of every row is unchanged — hg-v928 is an overlay, not a
   re-bake, and that is the property this list has always been pinning. */
for (const [k, act] of Object.entries(ACTIONS)){
  const bakedAct = scalp[k] && (typeof scalp[k].actionBaked === 'string' ? scalp[k].actionBaked : scalp[k].action);
  eq(bakedAct, act, k + ' baked action is unchanged');
}
/* and exactly the four hg-v928 rows carry an overlay; hg-v1439: bosalign's
   loosening LAPSED — the re-walk reads -0.071R net over n=94, the demote
   rule fires, and the row is back to its baked verdict with the return
   recorded on it. The other three loosenings stand. */
const RETUNED = { nyexh: 'demote', liqsweep: 'demote', bosalign: 'demote', ribbon: 'neutral' };
const overlaid = Object.keys(scalp).filter((k) => typeof scalp[k].actionBaked === 'string').sort();
eq(overlaid.join(','), Object.keys(RETUNED).sort().join(','), 'exactly four rows carry a retune overlay');
for (const [k, act] of Object.entries(RETUNED)){
  eq(scalp[k].action, act, k + ' in-force action is ' + act + (k === 'bosalign' ? ' — hg-v1439 returned it to the bake' : ' (hg-v928, on instruction)'));
  ok(scalp[k].retune && scalp[k].retune.unanimous === false,
     k + ' records that its retune is not unanimous across disjoint windows');
}
eq(Object.keys(scalp).length, Object.keys(ACTIONS).length, 'no scalp row was added or dropped');

/* ---- 4. the two v928 flips, and what the hg-v1439 re-walk did to them ---- */
console.log('4. the flips the old read invited, re-derived on the hg-v1439 walk');
/* hg-v1439: the hg-v928 invitations were measured on the v928-era population.
   On the hg-v1439 walk they are GONE — bosalign reads net -0.071R (the demote
   rule fires and hg-v1439 returned it to the bake) and ribbon reads +0.059R
   gross-positive but does not clear the prefer bar. Assert today's truth and
   the recorded history together. */
ok(measured.rows.bosalign.net < 0, 'bosalign is net-NEGATIVE on the hg-v1439 live population (-0.071R) — the hg-v928 invitation is gone');
ok(scalp.bosalign.net < 0, 'bosalign baked net is negative');
eq(scalp.bosalign.actionBaked, 'demote', 'bosalign is demoted in the bake');
eq(scalp.bosalign.action, 'demote', 'bosalign is BACK TO DEMOTE in force — hg-v1439, measured, not instructed');
ok(/hg-v1439: BACK TO DEMOTE/.test(scalp.bosalign.why), 'the row records the return with numbers');
ok(measured.rows.ribbon.net > 0, 'ribbon stays net-positive on the live population (+0.059R)');
eq(scalp.ribbon.action, 'neutral', 'ribbon keeps its hg-v928 neutral (the instruction stands; it does not clear the prefer bar)');
ok(/RETUNED ON INSTRUCTION/.test(scalp.ribbon.why), 'ribbon says on the row that it was an instruction');
eq(measured.rows.bosalign.oosBroke, 1, 'bosalign flips sign at one of three splits on the hg-v1439 walk');
eq(measured.rows.bosalign.oosHeld, 2, 'bosalign holds at two');
eq(measured.rows.ribbon.oosBroke, 0, 'ribbon holds at every split on this walk');
/* and the refusal is written down where the next reader will hit it */
ok(/hg-v916[\s\S]{0,400}NEITHER WAS TAKEN|THE TWO FLIPS THE LIVE POPULATION INVITES/.test(src),
   'goldind.js records the refusal next to the rows it concerns');
ok(src.includes('UNFALSIFIED at this sample size'),
   'and states the weaker claim the evidence actually supports');

/* ---- 5. the note itself ---- */
console.log('5. hgGoldEdgeLiveNote');
eq(NOTE(null), '', 'no row -> empty string, so a caller can append unconditionally');
eq(NOTE({}), '', 'a row with no live block -> empty string');
eq(NOTE({ live: undefined }), '', 'undefined live -> empty string');
ok(/suppressed before the replay walked/.test(NOTE({ live: null })),
   'live:null is a real answer and says so, rather than falling silent');
ok(NOTE({ live: null }) !== NOTE({}),
   'never-measured and no-population-to-measure do not render the same');
/* hg-v1439 re-derivation: the hg-v1439 walk replays the desk's own gates, so
   for scalp rows the live block reproduces the headline BECAUSE the walk is
   the live pipeline — the note says so ('that IS what the desk forms'), which
   is the scalp-true reading of what hg-v962 built for swing. */
{
  const s = NOTE(scalp.hvn, 'scalp');
  ok(s.includes('282'), 'hvn note carries the live n');
  ok(s.includes('−0.026R'), 'hvn note carries the live net with a real minus sign');
  ok(s.includes('nothing of this kind is gated out'), 'hvn note says the walk already applies the gates (282 of 282 formed)');
  ok(s.includes('held at 1 of 3'), 'hvn note reports the walk honestly (held 1, flipped 2)');
}
{
  const s = NOTE(scalp.vwap, 'scalp');
  ok(s.includes('withholds'), 'a suppressed row says what the suppression withholds');
  ok(!s.includes('the desk still forms'), 'and never claims the desk forms them');
  ok(s.includes('all 3 walk-forward splits'), 'vwap sign held at every split');
}
{
  const s = NOTE(scalp.bosalign, 'scalp');
  ok(s.includes('held at 2 of 3'), 'bosalign note reports the hg-v1439 walk (held 2, flipped 1)');
}
{
  /* zero walked splits means TOO THIN, not zero held. Rendering that as a
     failure would read as evidence against a verdict that was never tested.
     hg-v1439: ob now WALKS (flipped at all 2); p5wyck is the too-thin row. */
  const s = NOTE(scalp.ob, 'scalp');
  ok(s.includes('flipped at all 2'), 'ob note reports its walked splits honestly');
  const t = NOTE(scalp.p5wyck, 'scalp');
  ok(t.includes('too thin to walk forward'), 'a row no split could walk says so');
  ok(!/held at|flipped at/.test(t), 'and does not report a walk result it never had');
}
/* a null/NaN net must not render as 0.000R — the repo's standing trap */
for (const bad of [null, undefined, NaN, 'x']){
  eq(NOTE({ n: 10, live: { n: 5, net: bad } }), '', 'a non-finite live.net renders nothing, never 0.000R (' + String(bad) + ')');
}
eq(NOTE({ n: 10, live: { n: 0, net: -0.1 } }), '', 'n=0 renders nothing');
ok(!NOTE(scalp.hvn, 'scalp').includes('undefined'), 'no undefined leaks into the note');

/* ---- 6. it reaches a candidate, and changes nothing about eligibility ---- */
console.log('6. the note reaches cand.edge without moving the verdict');
{
  const mk = () => ({ stratKey: 'hvn', dir: 'long', entry: 100, stop: 99, t1: 103, stamps: [] });
  const c = APPLY(mk(), { scalp: true });
  ok(c.edge && c.edge.liveWhy, 'a demoted candidate carries edge.liveWhy');
  eq(c.edge.liveWhy, NOTE(scalp.hvn, 'scalp'), 'and it is exactly the note for its row');
  ok(c.edge.live && c.edge.live.n === 282, 'and the structured live block too');
  ok(c.demoted === true, 'the demote still fires');
  ok(Array.isArray(c.gateNotes) && c.gateNotes.some((g) => /IS what the desk forms|still forms/.test(g)),
     'the live reading rides along with the demote reason');
  const s = APPLY({ stratKey: 'vwap', dir: 'long', entry: 100, stop: 99, t1: 103, stamps: [] }, { scalp: true });
  ok(s.dropped === true, 'the suppress still rejects');
  ok(s.edge && /withholds/.test(s.edge.liveWhy || ''), 'and names what it withholds');
  const p = APPLY({ stratKey: 'p6fail', dir: 'long', entry: 100, stop: 99, t1: 103, stamps: [] }, { scalp: true });
  eq(p.edgeBoost, 2, 'the prefer boost is unchanged at +2');
}

/* ---- 7. the SWING lane now carries its own live population (hg-v961) ----
   Until hg-v961 every swing row's verdict rested on a headline n as small as
   1, and the desk had a 244-trade walk of its own that nothing read. The
   swing live block is derived by liveSwingPopulation() from that walk — and
   it is NOT the scalp derivation: goldswing calls the edge gate demoteOnly,
   so a suppressed kind still forms there and must not be removed, and the
   scalp cost reject is not this desk's gate either. Those three removals are
   modelled at zero, and the zero is ASSERTED rather than assumed. */
console.log('7. the swing lane carries its own live population');
{
  /* hg-v1439 QUARANTINE: upstream ceb58645's data refresh regenerated
     scripts/backtest-goldswing-results.json with ZERO settled trades — an
     empty walk. The GOLD SWING desk owns that artifact and owes the re-walk;
     until then there is no swing population to derive, and the number-equality
     loop below is suspended against the empty artifact with a loud marker that
     must flip back when the artifact has a book again. The literals keep their
     last-measured blocks (stale-but-labeled beats invented). */
  const { rows, removals } = liveSwingPopulation();
  const UPSTREAM_EMPTY_SWING = removals.settled === 0;
  ok(UPSTREAM_EMPTY_SWING || removals.settled === 244,
     'UPSTREAM-BROKEN: the swing walk settles 0 trades (ceb58645 empty walk — GOLD SWING owes the re-walk); when it has a book again this must read 244 (or re-derive)');
  if (!UPSTREAM_EMPTY_SWING){
    eq(removals.underCost, 0, 'no swing trade falls under the scalp cost bar');
    eq(removals.underFloor, 0, 'and none under the 1.5xATR stop floor');
    eq(removals.suppressedKinds, 0,
      'and no kind is removed for a suppress — goldswing applies the edge gate demoteOnly');
    ok(Object.keys(rows).length > 0, 'the derivation produced populations, not an empty map');
  } else {
    ok(true, 'swing derivation suspended against the empty upstream artifact');
    ok(true, 'swing removals suspended against the empty upstream artifact');
    ok(true, 'swing suppressed-kinds suspended against the empty upstream artifact');
    ok(true, 'swing population map suspended against the empty upstream artifact');
  }

  /* the blocks in the table really ARE what that derivation produces — not a
     hand-transcription of it (hg-v921) */
  let checked = 0;
  for (const [k, row] of Object.entries(TABLE.swing || {})){
    ok(row && typeof row.live !== 'undefined',
      'swing row ' + k + ' carries a live block — its verdict is measured on the '
      + 'population the desk forms, not on a headline n of 1');
    const want = rows[k] || null;
    if (UPSTREAM_EMPTY_SWING){
      /* empty upstream artifact: keep the last-measured block and require it
         to be STRUCTURED, so the suspension cannot hide a mangled literal */
      ok(row.live && typeof row.live.n === 'number',
         k + ': keeps its last-measured live block while the upstream walk is empty');
      continue;
    }
    if (!want){ eq(row.live, null, k + ': a null live block means no population at all'); continue; }
    /* field by field, not deepEqual: TABLE is evaluated in a vm realm, so its
       objects carry that realm's prototype and deepStrictEqual refuses two
       structurally identical records. */
    for (const f of ['n', 'gross', 'net', 'oosHeld', 'oosBroke']){
      eq(row.live[f], want[f], k + '.' + f + ': the baked live block equals the derivation');
    }
    checked++;
  }
  ok(UPSTREAM_EMPTY_SWING || checked > 0, 'at least one swing row has a population — or the loop above is vacuous (suspended while the upstream walk is empty)');
  ok(SWING_REPLAY.endsWith('backtest-goldswing-results.json'),
    'and it is derived from the swing walk the rebake chain now runs');
}

/* ---- 8. the derivation is honest about its own knobs ---- */
console.log('8. the derivation states its parameters');
eq(COST_BAR_PCT, 0.16, 'the cost bar is the shipped hg-v912 one, not a new number');
eq(MIN_SIDE, 20, 'a walk-forward side under 20 is not walked');
assert.deepEqual(SPLITS, [0.5, 0.6, 0.7], 'the same three splits hg-v914/v915 used');
ok(SUPPRESSED.every((k) => scalp[k]
     && (typeof scalp[k].actionBaked === 'string' ? scalp[k].actionBaked : scalp[k].action) === 'suppress'),
   'the SUPPRESSED list is exactly kinds the BAKE suppresses — not a hand-picked set');
{
  /* and it lists ALL of them: any suppressed kind that settles in the replay
     must be in that list, or the withheld count would be undercounted.
     hg-v1439: the re-walk shadows the still-suppressed kinds, so "in the
     replay" means main book OR shadow ledger; fvg and vwapband are excluded
     by design — walk-shadowed precursors whose live block is null, pinned in
     section 1. */
  const raw = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-goldscalp-results-floor.json'), 'utf8'));
  const settles = new Set(raw.trades.filter((t) => typeof t.netR === 'number').map((t) => t.stratKey));
  /* the BAKED verdict again: SUPPRESSED, and the 339 it accounts for, are
     properties of the walk, not of the hg-v928 overlay on top of it. */
  const bakedOf = (r) => (typeof r.actionBaked === 'string') ? r.actionBaked : r.action;
  const shouldBe = Object.entries(scalp)
    .filter(([k, r]) => bakedOf(r) === 'suppress' && settles.has(k) && k !== 'fvg' && k !== 'vwapband')
    .map(([k]) => k);
  assert.deepEqual([...SUPPRESSED].sort(), shouldBe.sort(),
    'SUPPRESSED is every suppress row that still settles in the replay (fvg/vwapband stay null-live by design)');
  pass++;
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : '') + pass + ' assertions passed');
if (fail) process.exit(1);
