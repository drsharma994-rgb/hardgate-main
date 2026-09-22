#!/usr/bin/env node
/**
 * hg-v920 — validate on DISJOINT windows, not nested ones.
 *
 * Five packs (v914, v915, v916, v918 and the grade-A test that prompted this)
 * checked a claim at 50/60/70 train/test splits and read three agreements as
 * three confirmations. They are not independent. The 70% test set sits inside
 * the 60% test set, which sits inside the 50% one — so the last window is
 * counted three times and a single strong period can carry all three.
 *
 * That is not hypothetical here. Grade A beat grade B/C among demoted rows at
 * every nested split (+0.065, +0.228, +0.219). On four disjoint windows it was
 * WORSE in three (-0.379, -0.137, -0.139) and better only in the last — the
 * window every nested test set contained. The nested reading would have
 * licensed unblocking 94% of the desk's output on one period's noise.
 *
 * splitDisjoint() cuts a time-ordered book into K windows that share no trade.
 * A claim holds when it holds in each of them, and the count of windows that
 * agree is reported rather than a single pooled verdict.
 *
 * Usage: node scripts/disjoint-windows.mjs   (demonstrates on the scalp book)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** K windows, in time order, sharing no row. rows must already be sorted. */
export function splitDisjoint(rows, k){
  if (!Array.isArray(rows) || !(k >= 2)) return [];
  const out = [];
  for (let i = 0; i < k; i++){
    out.push(rows.slice(Math.floor(rows.length * i / k), Math.floor(rows.length * (i + 1) / k)));
  }
  return out;
}

/** The nested splits this replaces — kept so a test can SHOW they overlap. */
export function splitNested(rows, fractions){
  return (fractions || [0.5, 0.6, 0.7]).map((f) => rows.slice(Math.floor(rows.length * f)));
}

const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
function se(v){
  if (v.length < 2) return NaN;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, x) => a + (x - m) * (x - m), 0) / (v.length - 1)) / Math.sqrt(v.length);
}

/**
 * Compare two cohorts across disjoint windows.
 * Returns one row per window plus how many agreed on the sign, so a caller
 * reports "3 of 4 windows" instead of a single number that hides the spread.
 */
export function compareDisjoint(rows, k, pickA, pickB, valueOf, minN){
  const floor = minN || 20;
  const windows = splitDisjoint(rows, k).map((seg) => {
    const a = seg.filter(pickA).map(valueOf);
    const b = seg.filter(pickB).map(valueOf);
    if (a.length < floor || b.length < floor){
      return { thin: true, nA: a.length, nB: b.length,
               from: seg.length ? seg[0].tISO : null, to: seg.length ? seg[seg.length - 1].tISO : null };
    }
    const mA = mean(a), mB = mean(b), diff = mA - mB;
    const sA = se(a), sB = se(b);
    return { thin: false, nA: a.length, nB: b.length, meanA: mA, meanB: mB, diff: diff,
             t: diff / Math.sqrt(sA * sA + sB * sB),
             from: seg[0].tISO, to: seg[seg.length - 1].tISO };
  });
  const judged = windows.filter((w) => !w.thin);
  return {
    windows,
    judged: judged.length,
    aBetter: judged.filter((w) => w.diff > 0).length,
    bBetter: judged.filter((w) => w.diff < 0).length,
    /* A claim "holds" only when every judged window agrees. Anything less is
       reported as the split it is, never rounded to a verdict. */
    unanimous: judged.length > 0 && (judged.every((w) => w.diff > 0) || judged.every((w) => w.diff < 0))
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])){
  const book = JSON.parse(readFileSync(join(HERE, 'backtest-goldscalp-results-floor.json'), 'utf8'))
    .trades.filter((t) => typeof t.netR === 'number' && !t.shadow)
    .sort((a, b) => String(a.tISO).localeCompare(String(b.tISO)));
  const stopPct = (t) => (typeof t.entry === 'number' && typeof t.stop === 'number' && t.entry > 0)
    ? Math.abs(t.entry - t.stop) / t.entry * 100 : 0;
  const today = book.filter((t) => stopPct(t) >= 0.16 && t.demoted);
  const grade = (t) => String(t.grade || '').replace('demoted-', '');
  const res = compareDisjoint(today, 4, (t) => grade(t) === 'A',
    (t) => grade(t) === 'B' || grade(t) === 'C', (t) => t.netR);
  console.log('grade A vs grade B/C among demoted rows, on DISJOINT windows\n');
  for (const w of res.windows){
    if (w.thin){ console.log('  %s..%s  thin (A=%d B/C=%d)', String(w.from).slice(0, 10), String(w.to).slice(0, 10), w.nA, w.nB); continue; }
    console.log('  %s..%s  A n=%s %s | B/C n=%s %s | diff %s  t=%s  %s',
      String(w.from).slice(0, 10), String(w.to).slice(0, 10),
      String(w.nA).padStart(4), (w.meanA >= 0 ? '+' : '') + w.meanA.toFixed(4),
      String(w.nB).padStart(4), (w.meanB >= 0 ? '+' : '') + w.meanB.toFixed(4),
      (w.diff >= 0 ? '+' : '') + w.diff.toFixed(4), (w.t >= 0 ? '+' : '') + w.t.toFixed(2),
      w.diff > 0 ? 'A better' : 'A WORSE');
  }
  console.log('\n  A better in %d of %d judged windows — unanimous: %s',
    res.aBetter, res.judged, res.unanimous ? 'yes' : 'NO, so the claim does not hold');
  const nested = splitNested(today, [0.5, 0.6, 0.7]);
  console.log('\n  and the nested splits this replaces share their rows:');
  console.log('    50%% test n=%d, 60%% n=%d, 70%% n=%d — the 70%% set is a SUBSET of the 60%%, which is a subset of the 50%%',
    nested[0].length, nested[1].length, nested[2].length);
}
