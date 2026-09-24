#!/usr/bin/env node
/**
 * hg-v916 — re-derive the `live` block on every HG_GOLD_SETUP_EDGE.scalp row.
 *
 * The baked n / gross / net on each row come from the whole main book of
 * scripts/backtest-goldscalp-results-floor.json. Since that replay was walked
 * the desk has been gated twice, and 45% of that book is trades it no longer
 * forms. This recomputes, per mechanic, the same measurement over the trades
 * that SURVIVE today's gates, plus whether the verdict's sign holds under a
 * walk-forward of that surviving population.
 *
 * Nothing here decides an action. It reports; goldind.js carries the numbers
 * and tests/test-gold-edge-live-population.mjs re-runs this against the replay
 * so the literals in goldind.js cannot drift away from the file they cite.
 *
 * Usage: node scripts/edge-live-population.mjs [--json]
 */
import { readFileSync } from 'node:fs';
import { GOLD_SCALP_WALK, GOLD_SWING_WALK } from '../lib/gold-artifacts.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPLAY = GOLD_SCALP_WALK;   /* hg-v959: one home, lib/gold-artifacts.mjs */

/* The two gates that fire between the replay and a card being minted today. */
export const COST_BAR_PCT = 0.16;                                   /* hg-v912 scalp cost reject */
export const SUPPRESSED = ['vwap', 'nyexh', 'liqsweep', 'sweep'];   /* suppressed AFTER the walk */
export const SPLITS = [0.5, 0.6, 0.7];
export const MIN_SIDE = 20;   /* a walk-forward side thinner than this is not walked at all */

const stopPct = (t) => {
  const e = t && t.entry, s = t && t.stop;
  if (!(typeof e === 'number' && typeof s === 'number' && e > 0)) return null;
  return Math.abs(e - s) / e * 100;
};
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const r3 = (x) => Math.round(x * 1000) / 1000;
const r4 = (x) => Math.round(x * 10000) / 10000;

/* A quality stamp reads "<NAME> Q<score>/10". `?` in place of the score means
   the detector returned before it scored anything. A kind is precursor-only
   when it stamps a quality on every row and not one of them is numeric —
   two conditions, because a kind that stamps no quality at all has told us
   nothing either way and must not be flagged. */
export const QUALITY_STAMP = /\sQ(\?|\d+)\/10/;
export function precursorOnly(rowsOfKind){
  if (!Array.isArray(rowsOfKind) || !rowsOfKind.length) return false;
  const stamped = rowsOfKind.filter((t) => (t.stamps || []).some((s) => QUALITY_STAMP.test(s)));
  if (stamped.length !== rowsOfKind.length) return false;
  return !stamped.some((t) => (t.stamps || []).some((s) => /\sQ\d+\/10/.test(s)));
}

/* ===================================================================
   hg-v961 — THE SWING HALF, which had no live population at all.

   hg-v916 built `live` for the scalp table and stopped there, so fourteen
   swing verdicts — two of them `prefer`, which carries a +2 rank boost on
   GOLD SWING — were measured on the whole-book replay and were outside the
   hg-v960 rule entirely.

   THE SCALP FILTER MUST NOT BE COPIED, and that is the trap this function
   exists to avoid. Scalp drops rows under the cost bar because hg-v912 made
   that gate REJECT there. goldswing.js:1734 calls the same gate with
   `demoteOnly: true` — on swing those rows are demoted and STILL FORMED, so
   filtering them out would delete a cohort the desk shows.

   MEASURED, not assumed: of the 244 settled swing trades, 0 sit under the
   0.16% cost bar, 0 sit under the 1.5xATR stop floor (the artifact's own
   counters.stopUnderFloor is 0, so the floor already bound during the walk),
   and no swing kind carries a `suppress` action, so nothing was withheld
   after it. The live population on this desk therefore IS the settled book —
   a coincidence, not a rule, which is why the three counts are returned
   beside it. The day a suppression or a reject lands on swing the
   coincidence breaks, and it breaks LOUDLY rather than silently.

   THE KEY ALIAS IS NOT COSMETIC: the table calls the weekly range breakout
   `weekly` and the walk records it as `wkbreak`. A naive join leaves the
   desk's strongest verdict — one of only two prefers — with no population at
   all, which is exactly the silent hole this pack is closing. */
export const SWING_REPLAY = GOLD_SWING_WALK;

/* table key -> walk stratKey, for the one pair that differs */
export const SWING_KEY_ALIAS = { weekly: 'wkbreak' };

export function liveSwingPopulation(path = SWING_REPLAY){
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const book = raw.trades
    .filter((t) => typeof t.netR === 'number' && !t.shadow)
    .sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)));

  /* the three removals the scalp desk makes, counted rather than applied —
     each is zero on this walk today and each is reported so a future
     re-bake cannot let a non-zero one pass unnoticed */
  const underCost = book.filter((t) => (stopPct(t) ?? 0) < COST_BAR_PCT).length;
  const underFloor = book.filter((t) => typeof t.stopAtr === 'number' && t.stopAtr < 1.5).length;
  const suppressedKinds = 0;   /* no swing row carries a suppress action */

  const out = {};
  for (const key of [...new Set(book.map((t) => t.stratKey))]){
    const rows = book.filter((t) => t.stratKey === key);
    if (!rows.length) continue;
    let oosHeld = 0, oosBroke = 0;
    for (const sp of SPLITS){
      const cut = Math.floor(book.length * sp);
      const ins = book.slice(0, cut).filter((t) => t.stratKey === key).map((t) => t.netR);
      const oos = book.slice(cut).filter((t) => t.stratKey === key).map((t) => t.netR);
      if (ins.length < MIN_SIDE || oos.length < MIN_SIDE) continue;
      if ((mean(ins) > 0) === (mean(oos) > 0)) oosHeld++; else oosBroke++;
    }
    out[key] = { n: rows.length, gross: r4(mean(rows.map((t) => t.rGross))),
                 net: r3(mean(rows.map((t) => t.netR))), oosHeld, oosBroke };
  }

  /* re-key onto the TABLE's names so a caller never has to know the alias */
  const rows = {};
  for (const [tableKey, walkKey] of Object.entries(SWING_KEY_ALIAS)){
    if (out[walkKey]) rows[tableKey] = out[walkKey];
  }
  const aliased = new Set(Object.values(SWING_KEY_ALIAS));
  for (const [k, v] of Object.entries(out)) if (!aliased.has(k)) rows[k] = v;

  return { rows, removals: { underCost, underFloor, suppressedKinds, settled: book.length } };
}

export function liveEdgePopulation(path = REPLAY){
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  /* shadow rows never entered the main book — they are a separate ledger */
  const book = raw.trades
    .filter((t) => typeof t.netR === 'number' && !t.shadow)
    .sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)));

  /* The population a card can still be minted from. A suppressed kind forms
     nothing, so it is excluded here — but still measured below, because what
     a suppression withholds is worth a number. */
  const passesCost = (t) => (stopPct(t) ?? 0) >= COST_BAR_PCT;
  const formed = book.filter((t) => passesCost(t) && !SUPPRESSED.includes(t.stratKey));

  const out = {};
  const keys = [...new Set(book.map((t) => t.stratKey))];
  for (const key of keys){
    const formsNone = SUPPRESSED.includes(key);
    /* For a live kind: what the desk forms. For a suppressed kind: what the
       suppression withholds, measured on the same cost-gated basis so the two
       numbers are comparable. */
    const rows = book.filter((t) => t.stratKey === key && passesCost(t));
    if (!rows.length) continue;
    /* The walk-forward splits the population the DESK walks in time, then asks
       whether this mechanic's sign in the early part survives into the late
       part. A suppressed kind is split on the cost-gated book of its own kind's
       era, since it is not in `formed`. */
    const base = formsNone ? book.filter(passesCost) : formed;
    let oosHeld = 0, oosBroke = 0;
    for (const sp of SPLITS){
      const cut = Math.floor(base.length * sp);
      const ins = base.slice(0, cut).filter((t) => t.stratKey === key).map((t) => t.netR);
      const oos = base.slice(cut).filter((t) => t.stratKey === key).map((t) => t.netR);
      if (ins.length < MIN_SIDE || oos.length < MIN_SIDE) continue;   /* too thin to walk */
      if ((mean(ins) > 0) === (mean(oos) > 0)) oosHeld++; else oosBroke++;
    }
    /* hg-v960: GROSS on the live population, because without it the table's
       own verdict rule is NOT COMPUTABLE. The suppress bar is
       (n>=50 && gross<=0 && net<=-0.20) and the prefer bar is
       (n>=50 && gross>0 && net>=+0.10) — both need a gross measured on the
       population the desk still forms, and this block emitted only net. Four
       rows carried a liveGross hand-recorded inside their hg-v928 retune
       blocks; for the other 21 the number did not exist anywhere in the repo,
       so every suppress and prefer verdict in force was unverifiable against
       the evidence that ships beside it.

       Validated rather than assumed: computed this way it reproduces all four
       hand-recorded values EXACTLY to four decimals — nyexh -0.1235,
       liqsweep 0.0313, bosalign 0.0654, ribbon 0.1093. Rounded to 4dp, not
       the 3dp `net` uses, because that is the precision those four were
       recorded at and a coarser round would not reproduce them. */
    const live = { n: rows.length, gross: r4(mean(rows.map((t) => t.rGross))),
                   net: r3(mean(rows.map((t) => t.netR))), oosHeld, oosBroke };
    if (formsNone) live.formsNone = true;
    /* hg-v923 — PRECURSOR-ONLY, derived rather than annotated.
       A detector that stamps a quality score onto its card ("Q7/10") tells us
       whether the row came from its scored path. When a kind carries that
       stamp on every row and the score is NEVER numeric, every firing in the
       book came from a pre-trigger early return and the record belongs to the
       precursor, not to the model. That is exactly `sweepob`: 62 of 62 print
       "Q?/10". Derived here so the literal writer emits it and a re-bake that
       finally sees a scored firing drops the flag on its own. */
    if (precursorOnly(book.filter((t) => t.stratKey === key))) live.precursorOnly = true;
    out[key] = live;
  }

  const whole = book.map((t) => t.netR);
  const today = formed.map((t) => t.netR);
  return {
    rows: out,
    book: {
      quoted: { n: whole.length, net: r3(mean(whole)) },
      today:  { n: today.length, net: r3(mean(today)) },
      droppedByCost: book.filter((t) => !passesCost(t)).length,
      droppedBySuppress: book.filter((t) => SUPPRESSED.includes(t.stratKey)).length,
      droppedByBoth: book.filter((t) => SUPPRESSED.includes(t.stratKey) && !passesCost(t)).length,
      noLongerFormed: whole.length - today.length
    }
  };
}

/* Run-as-CLI check by resolved path, not by suffix: the guard that imports
   this is tests/test-gold-edge-live-population.mjs, whose name ENDS WITH this
   file's name, so an endsWith() check fired on import and printed the table
   into the test output. */
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])){
  const res = liveEdgePopulation();
  if (process.argv.includes('--json')){ console.log(JSON.stringify(res, null, 2)); }
  else {
    const b = res.book;
    console.log('GOLD SCALP edge rows on the population the desk forms today');
    console.log('  quoted everywhere : n=%d  %s R', b.quoted.n, b.quoted.net.toFixed(3));
    console.log('  as formed today   : n=%d  %s R', b.today.n, b.today.net.toFixed(3));
    console.log('  no longer formed  : %d (%d cost-reject, %d suppressed, %d both)',
      b.noLongerFormed, b.droppedByCost, b.droppedBySuppress, b.droppedByBoth);
    console.log('');
    for (const [k, v] of Object.entries(res.rows).sort((a, b2) => b2[1].n - a[1].n)){
      console.log('  %s%s n=%s net %s   oos %d held / %d broke',
        k.padEnd(11), v.formsNone ? '[suppressed]' : '            ',
        String(v.n).padEnd(4), (v.net >= 0 ? '+' : '') + v.net.toFixed(3),
        v.oosHeld, v.oosBroke);
    }
  }
}
