/**
 * hg-v932 — the excursions both gold walks need, in ONE place.
 *
 * WHAT WAS WRONG. scripts/backtest-omnigold.mjs has computed `tr.mfe` and
 * `tr.mae` on every filled bar since the 2R work, under a comment that says
 * exactly why they exist:
 *
 *   "Answering 'would 1R have paid better?' needs to know how far the trade
 *    ran BEFORE it resolved, and no artifact recorded that. mfe/mae are that
 *    record."
 *
 * ...and then `settleRecord` never emitted them. The work was done and thrown
 * away on the way out, so the artifact still could not answer the question the
 * comment poses. scripts/backtest-goldscalp.mjs did not track them at all.
 *
 * So on the gold side EVERY exit question — is the fixed 2.0R target right?
 * would a breakeven move have paid? is the stop wider than it needs to be? —
 * has been not merely unresolved but UNMEASURABLE, while the crypto side has
 * had hgHeatProfile / hgStopSweep since hg-v182 and a whole exit-optimisation
 * artifact.
 *
 * THE RULE IS DELIBERATELY CONSERVATIVE, and it is the reason this is shared
 * rather than copied: a bar that touches the stop contributes NOTHING to the
 * favourable excursion. Intrabar order is unknown and the walk already
 * resolves a both-touch bar as a loss, so crediting the high of the bar that
 * stopped the trade out would let the sweep invent gains no real fill saw. Two
 * copies of that rule drift the first time either harness is edited, and the
 * copy that drifts is the one that flatters its desk.
 *
 * Nothing here decides an outcome. These are a record of what price offered
 * between fill and exit; no gate, target or stop reads them.
 */

/**
 * Fold one bar into a trade's running excursions. Mutates `tr.mae` / `tr.mfe`
 * in PRICE units (normalised to R only at emit, by excursionR).
 *
 * `hitStop` is passed in rather than recomputed so the caller's definition of
 * a stop touch — which decides the trade — is the same one that silences the
 * favourable side here. A second opinion about that is how the two halves
 * disagree.
 */
export function excursionStep(tr, bar, dir, entry, stop, hitStop){
  if (!tr || !bar) return tr;
  const risk = Math.abs(stop - entry);
  if (hitStop || !(risk > 0)) return tr;
  const h = +bar.h, l = +bar.l;
  const fav = dir === 'long' ? (h - entry) : (entry - l);
  if (isFinite(fav) && (tr.mfe == null || fav > tr.mfe)) tr.mfe = fav;
  const adv = dir === 'long' ? (entry - l) : (h - entry);
  if (isFinite(adv) && (tr.mae == null || adv > tr.mae)) tr.mae = adv;
  return tr;
}

/**
 * The pair as R multiples, ready to emit. Null when there is no risk to
 * normalise by or nothing was recorded — an unfilled trade has no excursion,
 * and a zero is a claim that price never moved, which is a different thing.
 *
 * Both are reported UNSIGNED and non-negative: mae is how far against, mfe is
 * how far in favour. A trade stopped on its fill bar records neither.
 */
export function excursionR(tr, entry, stop){
  const risk = Math.abs(stop - entry);
  if (!(risk > 0)) return { maeR: null, mfeR: null };
  const n = v => (v == null || !isFinite(v)) ? null : +(Math.max(0, v) / risk).toFixed(4);
  return { maeR: n(tr && tr.mae), mfeR: n(tr && tr.mfe) };
}
