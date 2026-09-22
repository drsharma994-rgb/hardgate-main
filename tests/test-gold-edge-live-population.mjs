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
import { liveEdgePopulation, COST_BAR_PCT, SUPPRESSED, SPLITS, MIN_SIDE,
         precursorOnly, QUALITY_STAMP, REPLAY } from '../scripts/edge-live-population.mjs';

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
  eq(flagged.length, 1, 'exactly one kind is precursor-only on this replay');
  eq(flagged[0], 'sweepob', 'and it is sweepob');
  const sw = raw.trades.filter((t) => t.stratKey === 'sweepob');
  const stamp = (t) => (t.stamps || []).find((x) => QUALITY_STAMP.test(x)) || '';
  ok(sw.length > 0 && sw.every((t) => stamp(t)), 'every sweepob row carries a quality stamp (' + sw.length + ')');
  eq(sw.filter((t) => /\sQ\d+\/10/.test(stamp(t))).length, 0, 'and not one of them is numeric');
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
  ok(scalp[k] && scalp[k].action === 'suppress', k + ' is still a suppress row');
  ok(scalp[k] && scalp[k].live && scalp[k].live.formsNone === true, k + ' live is flagged formsNone');
}
/* fvg / vwapband were shadowed at walk time — no population, and none invented */
for (const k of ['fvg', 'vwapband']){
  eq(scalp[k].live, null, k + ' was shadowed at walk time, so live is null');
  ok(!measured.rows[k], k + ' has no non-shadow settle in the replay');
}

/* ---- 2. the headline the table cites ---- */
console.log('2. the book figure, as quoted and as the desk forms it');
const b = measured.book;
eq(b.quoted.n, 2193, 'the quoted book is 2193 settled');
eq(b.quoted.net, -0.148, 'the quoted book is -0.148R');
eq(b.today.n, 1205, 'the desk forms 1205 of them');
eq(b.today.net, -0.02, 'as formed, the book is -0.020R');
eq(b.noLongerFormed, 988, '988 are no longer formed');
eq(b.droppedByCost, 671, '671 under the cost reject');
eq(b.droppedBySuppress, 470, '470 from suppressed kinds');
eq(b.droppedByBoth, 153, '153 are both');
eq(b.droppedByCost + b.droppedBySuppress - b.droppedByBoth, b.noLongerFormed, 'the union arithmetic closes');
ok(Math.round(b.noLongerFormed / b.quoted.n * 100) === 45, 'that is 45% of the quoted book');
/* The five-line ladder in the cost-gate comment is the thing a reader will
   actually quote back. Check each line against the derivation rather than
   grepping for a substring that also appears in the table header — a stale
   figure in one of the two comments must not hide behind the other. */
const LADDER = [
  [/quoted everywhere\s+n=(\d+)\s+([-+][\d.]+)R/,      2193, -0.148],
  [/minus the four suppressed kinds\s+n=(\d+)\s+([-+][\d.]+)R/, 1723, -0.102],
  [/minus this cost reject only\s+n=(\d+)\s+([-+][\d.]+)R/,     1522, -0.053],
  [/what the desk forms\s+n=(\d+)\s+([-+][\d.]+)R/,             1205, -0.020],
  [/BEFORE venue cost\s+n=(\d+)\s+([-+][\d.]+)R/,               1205, +0.051]
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
for (const n of ['2,193', '988', '671', '470', '153']){
  ok(src.includes(n), 'goldind.js states ' + n);
}

/* ---- 3. NOT ONE ACTION CHANGED ---- */
console.log('3. no verdict moved on the live read');
const ACTIONS = {
  fvg: 'suppress', vwapband: 'suppress', vwap: 'suppress', nyexh: 'suppress',
  liqsweep: 'suppress', sweep: 'suppress', hvn: 'demote', ob: 'demote',
  openrange: 'demote', bosalign: 'demote', asian: 'demote', ribbon: 'demote',
  rsidiv: 'demote', p4laf: 'demote', silverb: 'demote', p6fail: 'prefer',
  p9volbar: 'prefer', p5drive: 'demote', p6comp: 'demote', sweepob: 'neutral',
  p8range: 'neutral', p5vwap: 'neutral', p5wyck: 'neutral', p8vpinbo: 'neutral',
  p7scalp: 'neutral', vpbook: 'neutral', adrfade: 'neutral'
};
for (const [k, act] of Object.entries(ACTIONS)) eq(scalp[k] && scalp[k].action, act, k + ' action is unchanged');
eq(Object.keys(scalp).length, Object.keys(ACTIONS).length, 'no scalp row was added or dropped');

/* ---- 4. the two refused flips, re-derived ---- */
console.log('4. the flips the in-sample read invites, refused on the walk');
/* Both are net-positive on the live population, so the table's own net<0
   demote bar no longer holds them. Neither survives. Assert both halves: the
   invitation is real AND the walk refuses it. */
for (const k of ['bosalign', 'ribbon']){
  ok(measured.rows[k].net > 0, k + ' IS net-positive on the live population (the invitation is real)');
  ok(scalp[k].net < 0, k + ' baked net is negative (which is what put the demote there)');
  eq(scalp[k].action, 'demote', k + ' is still demoted anyway');
}
eq(measured.rows.bosalign.oosBroke, 3, 'bosalign flips sign at all three splits');
eq(measured.rows.bosalign.oosHeld, 0, 'bosalign holds at none');
ok(measured.rows.ribbon.oosBroke >= 1, 'ribbon flips sign at at least one split');
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
{
  const s = NOTE(scalp.hvn);
  ok(s.includes('263'), 'hvn note carries the live n');
  ok(s.includes('−0.049R'), 'hvn note carries the live net with a real minus sign');
  ok(s.includes('128'), 'hvn note says how many of the baked 391 are gated out');
  ok(s.includes('held at 2 of 3'), 'hvn note reports the partial walk honestly');
}
{
  const s = NOTE(scalp.vwap);
  ok(s.includes('withholds'), 'a suppressed row says what the suppression withholds');
  ok(!s.includes('the desk still forms'), 'and never claims the desk forms them');
  ok(s.includes('all 3 walk-forward splits'), 'vwap sign held at every split');
}
{
  const s = NOTE(scalp.bosalign);
  ok(s.includes('flipped at all 3'), 'bosalign note reports the flip at every split');
}
{
  /* zero walked splits means TOO THIN, not zero held. Rendering that as a
     failure would read as evidence against a verdict that was never tested. */
  const s = NOTE(scalp.ob);
  ok(s.includes('too thin to walk forward'), 'a row no split could walk says so');
  ok(!/held at|flipped at/.test(s), 'and does not report a walk result it never had');
}
/* a null/NaN net must not render as 0.000R — the repo's standing trap */
for (const bad of [null, undefined, NaN, 'x']){
  eq(NOTE({ n: 10, live: { n: 5, net: bad } }), '', 'a non-finite live.net renders nothing, never 0.000R (' + String(bad) + ')');
}
eq(NOTE({ n: 10, live: { n: 0, net: -0.1 } }), '', 'n=0 renders nothing');
ok(!NOTE(scalp.hvn).includes('undefined'), 'no undefined leaks into the note');

/* ---- 6. it reaches a candidate, and changes nothing about eligibility ---- */
console.log('6. the note reaches cand.edge without moving the verdict');
{
  const mk = () => ({ stratKey: 'hvn', dir: 'long', entry: 100, stop: 99, t1: 103, stamps: [] });
  const c = APPLY(mk(), { scalp: true });
  ok(c.edge && c.edge.liveWhy, 'a demoted candidate carries edge.liveWhy');
  eq(c.edge.liveWhy, NOTE(scalp.hvn), 'and it is exactly the note for its row');
  ok(c.edge.live && c.edge.live.n === 263, 'and the structured live block too');
  ok(c.demoted === true, 'the demote still fires');
  ok(Array.isArray(c.gateNotes) && c.gateNotes.some((g) => /still forms/.test(g)),
     'the live reading rides along with the demote reason');
  const s = APPLY({ stratKey: 'vwap', dir: 'long', entry: 100, stop: 99, t1: 103, stamps: [] }, { scalp: true });
  ok(s.dropped === true, 'the suppress still rejects');
  ok(s.edge && /withholds/.test(s.edge.liveWhy || ''), 'and names what it withholds');
  const p = APPLY({ stratKey: 'p6fail', dir: 'long', entry: 100, stop: 99, t1: 103, stamps: [] }, { scalp: true });
  eq(p.edgeBoost, 2, 'the prefer boost is unchanged at +2');
}

/* ---- 7. the SWING lane was not touched, and the reason is measured ---- */
console.log('7. the swing lane is unaffected, measured not assumed');
{
  const sw = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-goldswing-results.json'), 'utf8'));
  const rows = sw.trades.filter((t) => typeof t.netR === 'number' && !t.shadow);
  const under = rows.filter((t) => {
    const e = t.entry, s2 = t.stop;
    if (!(typeof e === 'number' && typeof s2 === 'number' && e > 0)) return false;
    return Math.abs(e - s2) / e * 100 < COST_BAR_PCT;
  });
  eq(under.length, 0, 'no swing trade falls under the scalp cost bar');
  ok(rows.length > 200, 'on a swing book of ' + rows.length + ' settled');
  for (const [k, row] of Object.entries(TABLE.swing || {})){
    ok(!('live' in row), 'swing row ' + k + ' gets no live block — its baked population is intact');
  }
}

/* ---- 8. the derivation is honest about its own knobs ---- */
console.log('8. the derivation states its parameters');
eq(COST_BAR_PCT, 0.16, 'the cost bar is the shipped hg-v912 one, not a new number');
eq(MIN_SIDE, 20, 'a walk-forward side under 20 is not walked');
assert.deepEqual(SPLITS, [0.5, 0.6, 0.7], 'the same three splits hg-v914/v915 used');
ok(SUPPRESSED.every((k) => scalp[k] && scalp[k].action === 'suppress'),
   'the SUPPRESSED list is exactly kinds the table suppresses — not a hand-picked set');
{
  /* and it lists ALL of them: any main-book kind the table suppresses must be
     in that list, or its 470 would be undercounted */
  const raw = JSON.parse(readFileSync(join(ROOT, 'scripts/backtest-goldscalp-results-floor.json'), 'utf8'));
  const inBook = new Set(raw.trades.filter((t) => !t.shadow).map((t) => t.stratKey));
  const shouldBe = Object.entries(scalp).filter(([k, r]) => r.action === 'suppress' && inBook.has(k)).map(([k]) => k);
  assert.deepEqual([...SUPPRESSED].sort(), shouldBe.sort(),
    'SUPPRESSED is every suppress row that still walks in the main book');
  pass++;
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' : '') + pass + ' assertions passed');
if (fail) process.exit(1);
