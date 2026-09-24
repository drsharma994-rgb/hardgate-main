#!/usr/bin/env node
/* HARDGATE hg-v956 — what the gold weekend actually costs the edge table, and
 * the gate that was already paying for it.
 *
 * hg-v953 measured that 679 of GOLD SCALP's 2,575 committed trades (26.4%)
 * formed inside the gold weekend on PAXGUSDT bars no broker printed, and said
 * that walk "is what HG_GOLD_SETUP_EDGE is measured on". That is TRUE of the
 * headline n / gross / net on every row and FALSE of the `live` figures
 * hg-v916 added and hg-v928 retuned the verdicts on — and this pack is the
 * measurement that separates the two, including the correction to my own
 * earlier claim.
 *
 * THE MECHANISM NOBODY HAD MEASURED. A weekend PAXG bar is a thin crypto
 * proxy with almost no range, so ATR collapses, so the stop is narrow — and a
 * narrow stop is exactly what the hg-v912 cost reject removes. Measured:
 * median stop width 0.038% on weekend rows against 0.267% on open ones, a
 * factor of seven, against a 0.16% bar. 98.4% of weekend rows fail that gate
 * versus 6.2% of open rows.
 *
 * So the live population the table's `live` column is measured on — the
 * population the desk forms TODAY — is 99.4% gold-open already. The cost
 * gate has been paying for the calendar since hg-v912 without anyone
 * knowing, which is worth establishing rather than assuming in either
 * direction.
 *
 * TWO BASES, KEPT APART, because conflating them is how the wrong number gets
 * quoted:
 *
 *   WHOLE BOOK — what the row's headline figures are measured on. Contaminated
 *     at 26.4%, and re-deriving the table's own bars there moves 7 of 27
 *     verdicts. That is ARITHMETIC ON A BASIS hg-v916 ALREADY RETIRED, not a
 *     finding that seven verdicts are wrong.
 *
 *   LIVE — what hg-v916 built and hg-v928 acted on. 7 weekend rows in 1,205.
 *     Nothing to scope, and nothing moves.
 *
 * NOTHING SHIPS. The desk's bar since hg-v922 is four DISJOINT windows at BOTH
 * fill bounds agreeing on win AND gross AND net; imported from
 * factor-separation / demote-separation rather than rebuilt. Every moving row
 * is THIN there by a wide margin, and the pooled read is thin too — precisely
 * because the cost gate already removed the cohort. hg-v920 refused three
 * loosenings on this evidence, hg-v944 a fourth, hg-v945 reported five leans
 * without acting on one.
 *
 * The calendar is the repo's own hgInGoldWeekend, CALLED, never re-derived —
 * the guard asserts this file contains no calendar arithmetic.
 *
 * Re-derive: node scripts/gold-edge-tradeable.mjs [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scalpBook, measure, WINDOWS, MIN_SIDE_SCALP, stopPct, COST_BAR_PCT } from './factor-separation.mjs';
import { BOUNDS, verdict, lean } from './demote-separation.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* THE TABLE'S OWN WALK, and not the neighbouring file. scripts/ holds THREE
   goldscalp artifacts and they are not interchangeable: the edge table's
   `live` column is computed by edge-live-population.mjs, which reads
   backtest-goldscalp-results-FLOOR.json (2,605 trades), and AGENTS.md's
   HG_GOLD_EDGE_WALK names that same span. hg-v953 quoted the 2,575-trade
   backtest-goldscalp-results.json and called it "what HG_GOLD_SETUP_EDGE is
   measured on" — the wrong file, in my own pack, and the correction is this
   import rather than a sentence about it. */
const WALK = path.join(ROOT, 'scripts/backtest-goldscalp-results-floor.json');
export const WALK_PATH = WALK;

/* THE CALENDAR IS LOADED, NOT WRITTEN. */
const cal = {};
vm.createContext(cal);
cal.window = cal;
vm.runInContext(readFileSync(path.join(ROOT, 'indicators2.js'), 'utf8'), cal, { filename: 'indicators2.js' });
if (typeof cal.hgInGoldWeekend !== 'function'){
  console.error('FATAL: indicators2.js did not export hgInGoldWeekend — refusing to re-derive a calendar here.');
  process.exit(1);
}
export const inWeekend = (iso) => cal.hgInGoldWeekend(Date.parse(iso) / 1000);
export const isTradeable = (t) => !inWeekend(t.tISO);

/* THE TABLE'S OWN BARS, stated once. These are hg-v574's, unchanged by this
 * pack — the point is to apply them to a different population, not to move
 * them. hg-v928 documented that the demote bar has no sample floor; that is
 * a known gap in the rule and is reported, not silently patched here. */
export function tableVerdict(s){
  if (!s || !s.n) return 'none';
  if (s.n >= 50 && s.gross <= 0 && s.net <= -0.20) return 'suppress';
  if (s.n >= 50 && s.gross > 0 && s.net >= 0.10) return 'prefer';
  if (s.net < 0) return 'demote';
  return 'neutral';
}
function agg(rows){
  const n = rows.length;
  if (!n) return null;
  return { n: n,
    gross: rows.reduce((a, r) => a + (+r.rGross || 0), 0) / n,
    net: rows.reduce((a, r) => a + (+r.netR || 0), 0) / n };
}

export function run(opts){
  opts = opts || {};
  const raw = JSON.parse(readFileSync(opts.path || WALK, 'utf8'));
  const trades = (raw.trades || []).filter((t) => t && t.stratKey);

  /* ---- (1) what moves, on the table's own basis ---- */
  const kinds = [...new Set(trades.map((t) => t.stratKey))].sort();
  const rows = [];
  for (const k of kinds){
    const all = trades.filter((t) => t.stratKey === k);
    const tr = all.filter(isTradeable);
    const A = agg(all), T = agg(tr);
    const vA = tableVerdict(A), vT = tableVerdict(T);
    rows.push({ kind: k, all: A, tradeable: T, verdictAll: vA, verdictTradeable: vT,
                moves: vA !== vT,
                weekendShare: A && A.n ? (A.n - (T ? T.n : 0)) / A.n : null });
  }
  const movers = rows.filter((r) => r.moves);

  /* ---- THE MECHANISM: why the live population is already clean ---- */
  /* Not asserted, measured. A weekend proxy bar is quiet, so its ATR is small,
     so the stop is narrow, so the hg-v912 cost reject drops it. The medians
     and the rejection rates are the evidence for that sentence. */
  const wk = trades.filter((t) => !isTradeable(t));
  const op = trades.filter(isTradeable);
  const med = (a) => {
    const v = a.map(stopPct).filter((x) => x > 0).sort((p, q) => p - q);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  const under = (a) => a.filter((t) => stopPct(t) < COST_BAR_PCT).length;
  const mechanism = {
    costBarPct: COST_BAR_PCT,
    weekend: { n: wk.length, medianStopPct: med(wk), underBar: under(wk),
               underBarShare: wk.length ? under(wk) / wk.length : null },
    open: { n: op.length, medianStopPct: med(op), underBar: under(op),
            underBarShare: op.length ? under(op) / op.length : null }
  };

  /* ---- (2) whether the separation survives the desk's own bar ---- */
  /* pooled first: does "gold was open" separate outcomes across the book */
  const books = {};
  for (const end of BOUNDS) books[end] = scalpBook(end, opts.path || WALK);
  const pooled = {};
  for (const end of BOUNDS) pooled[end] = measure(books[end], isTradeable, MIN_SIDE_SCALP);
  const pooledVerdict = verdict(pooled['as-recorded'], pooled.lower);
  const pooledLean = lean(pooled['as-recorded'], pooled.lower);

  /* then per moving kind, which is where a verdict would have to come from */
  const perKind = [];
  for (const m of movers){
    const m2 = {};
    for (const end of BOUNDS)
      m2[end] = measure(books[end].filter((t) => t.stratKey === m.kind), isTradeable, MIN_SIDE_SCALP);
    perKind.push({ kind: m.kind, from: m.verdictAll, to: m.verdictTradeable,
                   asRecorded: m2['as-recorded'], lower: m2.lower,
                   verdict: verdict(m2['as-recorded'], m2.lower),
                   lean: lean(m2['as-recorded'], m2.lower) });
  }

  /* NOTHING SHIPS WITHOUT A PER-KIND VERDICT. Stated as an expression, not as
   * prose: hg-v937 shipped a verdict inline and a mutation survived. */
  const ships = perKind.filter((p) => p.verdict !== null).map((p) => p.kind);

  /* THE LIVE BASIS, stated as a number rather than left to the reader. */
  const liveBook = books['as-recorded'];
  const liveWeekend = liveBook.filter((t) => !isTradeable(t)).length;
  const live = { n: liveBook.length, weekend: liveWeekend,
                 weekendShare: liveBook.length ? liveWeekend / liveBook.length : null };

  return { meta: { walk: raw.meta && raw.meta.span, universe: raw.meta && raw.meta.universe,
                   trades: trades.length,
                   weekend: trades.length - trades.filter(isTradeable).length,
                   windows: WINDOWS, minSide: MIN_SIDE_SCALP },
           mechanism: mechanism, live: live,
           rows: rows, movers: movers.map((m) => m.kind),
           pooled: { asRecorded: pooled['as-recorded'], lower: pooled.lower,
                     verdict: pooledVerdict, lean: pooledLean },
           perKind: perKind, ships: ships };
}

if (process.argv[1] && process.argv[1].endsWith('gold-edge-tradeable.mjs')){
  const out = run();
  const pc = (x) => (x === null || x === undefined ? 'n/a' : (100 * x).toFixed(1) + '%');
  const sg = (x) => (x >= 0 ? '+' : '') + x.toFixed(4);
  console.log('GOLD EDGE TABLE, SCOPED TO BARS GOLD PRINTED');
  console.log('  walk ' + (out.meta.walk ? out.meta.walk.from.slice(0, 10) + ' -> ' + out.meta.walk.to.slice(0, 10) : '?')
    + ' · ' + out.meta.trades + ' trades · ' + out.meta.weekend + ' formed while shut ('
    + pc(out.meta.weekend / out.meta.trades) + ')');
  console.log('  universe: ' + (out.meta.universe || '(not recorded)'));
  console.log('');
  const m = out.mechanism;
  console.log('THE MECHANISM — why the live population is already clean.');
  console.log('    median stop width   weekend ' + m.weekend.medianStopPct.toFixed(3)
    + '%   open ' + m.open.medianStopPct.toFixed(3) + '%   cost bar ' + m.costBarPct + '%');
  console.log('    under the cost bar  weekend ' + pc(m.weekend.underBarShare)
    + ' (' + m.weekend.underBar + '/' + m.weekend.n + ')   open ' + pc(m.open.underBarShare)
    + ' (' + m.open.underBar + '/' + m.open.n + ')');
  console.log('    A weekend proxy bar is quiet, so its ATR is small, so the stop is narrow —');
  console.log('    and the hg-v912 cost reject removes narrow stops. It has been paying for the');
  console.log('    calendar since it shipped, which nobody had established either way.');
  console.log('');
  console.log('THE LIVE BASIS — what hg-v916 built and hg-v928 acted on.');
  console.log('    ' + out.live.n + ' trades · ' + out.live.weekend + ' formed while shut ('
    + pc(out.live.weekendShare) + ') — nothing to scope, and nothing moves.');
  console.log('');
  console.log('(1) WHAT MOVES on the WHOLE-BOOK basis — the row headline figures. Arithmetic on a');
  console.log('    basis hg-v916 already retired, NOT a finding that seven verdicts are wrong.');
  for (const r of out.rows.filter((x) => x.moves)){
    console.log('    ' + r.kind.padEnd(12)
      + ' n ' + String(r.all.n).padStart(4) + ' -> ' + String(r.tradeable ? r.tradeable.n : 0).padStart(4)
      + '  net ' + sg(r.all.net) + ' -> ' + sg(r.tradeable.net)
      + '   ' + r.verdictAll + ' -> ' + r.verdictTradeable);
  }
  console.log('    ' + out.movers.length + ' of ' + out.rows.length + ' verdicts would move.');
  console.log('');
  console.log('(2) WHETHER IT SURVIVES — 4 disjoint windows, both fill bounds, win AND gross AND net.');
  const p = out.pooled;
  console.log('    POOLED across the book: verdict ' + (p.verdict || 'NONE')
    + ' · lean ' + (p.lean || 'none')
    + (p.asRecorded && !p.asRecorded.thin
        ? ' · dNet ' + sg(p.asRecorded.dNet) + ' / ' + sg(p.lower.dNet) : ' · thin'));
  for (const k of out.perKind){
    const a = k.asRecorded;
    console.log('    ' + k.kind.padEnd(12) + ' ' + (k.from + '->' + k.to).padEnd(18)
      + (a && a.thin ? 'THIN (' + a.nA + ' open / ' + a.nB + ' weekend; needs '
            + (out.meta.minSide * out.meta.windows) + ' a side)'
          : 'verdict ' + (k.verdict || 'NONE') + ' · lean ' + (k.lean || 'none')));
  }
  console.log('');
  console.log('    SHIPS: ' + (out.ships.length ? out.ships.join(', ')
    : 'NOTHING. No moving row carries a verdict, so no verdict moves.'));
  console.log('    A contaminated measurement is not a measurement of the opposite —');
  console.log('    it is a measurement nobody has made. Nothing is gated on any of this.');
}
