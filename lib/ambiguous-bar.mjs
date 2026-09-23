/**
 * hg-v932 — which came first, inside the bar.
 *
 * A `both-touch` row is a bar whose range holds the stop AND the target. At
 * bar resolution the order is unknowable, so both gold walks resolve it
 * stop-first — the conservative choice, and the right one absent better data.
 *
 * WHAT THAT COSTS. hg-v931 measured it: OMNIGOLD has 672 such rows, 8.3% of
 * its filled book, against 23 (0.9%) on GOLD SCALP — because OMNIGOLD's scalp
 * lane runs on 1h bars and GOLD SCALP's on 15m, and a longer bar is likelier
 * to hold both levels. It is a RESOLUTION artifact, not a difference in edge.
 * And it is not academic: those rows are the whole reason OMNIGOLD's win rate
 * reads 30.4% at one fill bound and 38.6% at the other, which is the
 * difference between a desk below its breakeven and one above it.
 *
 * A finer bar inside the ambiguous one answers it. This module is that answer,
 * as a pure function: no fetching, no I/O, no opinion about where the finer
 * bars come from.
 *
 * THREE OUTCOMES, AND THE THIRD IS NOT A FAILURE:
 *   'stop'   — a finer bar touched the stop before any touched the target
 *   'target' — the reverse
 *   null     — still ambiguous, and the caller keeps the conservative answer
 *
 * null happens when the finer bars are missing, do not cover the window, or
 * when a finer bar ITSELF holds both levels. Recursing to a finer resolution
 * again is the caller's business; this one reports honestly rather than
 * guessing, because a guess here writes itself straight into the desk's
 * win rate.
 */

/** Does this bar's range reach the level, for this direction's stop? */
export function touchesStop(bar, dir, stop){
  return dir === 'long' ? (+bar.l <= stop) : (+bar.h >= stop);
}
/** ...and the target. */
export function touchesTarget(bar, dir, t1){
  return dir === 'long' ? (+bar.h >= t1) : (+bar.l <= t1);
}

/**
 * Resolve one ambiguous bar.
 *
 * `finer` is any set of bars; only those whose open time falls inside
 * [barStartSec, barEndSec) are considered, so a caller may hand over a whole
 * day and let this pick the window. They are sorted here rather than trusted:
 * an out-of-order feed would otherwise silently decide the answer.
 *
 * Returns { verdict, at, scanned, reason }.
 */
export function resolveAmbiguousBar(finer, opts){
  const o = opts || {};
  const { dir, stop, t1, barStartSec, barEndSec } = o;
  const out = { verdict: null, at: null, scanned: 0, reason: '' };
  if (!Array.isArray(finer) || !finer.length){ out.reason = 'no finer bars'; return out; }
  if (dir !== 'long' && dir !== 'short'){ out.reason = 'no direction'; return out; }
  if (!isFinite(stop) || !isFinite(t1)){ out.reason = 'no levels'; return out; }

  const win = finer
    .filter(b => b && isFinite(+b.t) && +b.t >= barStartSec && +b.t < barEndSec)
    .sort((a, b) => (+a.t) - (+b.t));
  out.scanned = win.length;
  if (!win.length){ out.reason = 'finer bars do not cover the window'; return out; }

  for (const b of win){
    const s = touchesStop(b, dir, stop);
    const g = touchesTarget(b, dir, t1);
    if (s && g){
      /* THE SAME PROBLEM, ONE LEVEL DOWN. Resolving it by picking a side here
         would be the guess this module exists to avoid. */
      out.reason = 'a finer bar holds both levels too';
      return out;
    }
    if (s){ out.verdict = 'stop'; out.at = +b.t; out.reason = 'stop touched first'; return out; }
    if (g){ out.verdict = 'target'; out.at = +b.t; out.reason = 'target touched first'; return out; }
  }
  out.reason = 'no finer bar reached either level';
  return out;
}

/**
 * Apply a verdict to a walk row, or leave it exactly as it was.
 *
 * FAILS CONSERVATIVE: a null verdict changes nothing, so a missing or
 * unhelpful finer feed leaves the stop-first book the desk already had. The
 * row records HOW it was resolved either way, so a reader can tell a measured
 * win from an assumed loss — which is the whole point of doing this.
 */
export function applyResolution(row, res, rr){
  if (!row) return row;
  if (!res || !res.verdict){
    row.ambiguousResolved = false;
    if (res && res.reason) row.ambiguousWhy = res.reason;
    return row;
  }
  row.ambiguousResolved = true;
  row.ambiguousWhy = res.reason;
  row.resolvedAt = res.at;
  if (res.verdict === 'target'){
    row.outcome = 'win';
    row.rMultiple = isFinite(rr) ? +Number(rr).toFixed(3) : row.rMultiple;
  } else {
    row.outcome = 'loss';
    row.rMultiple = -1;
  }
  return row;
}
