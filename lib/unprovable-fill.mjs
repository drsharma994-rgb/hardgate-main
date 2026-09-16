/* HARDGATE — trades whose EXISTENCE the bar data cannot establish, and the
   interval that honesty about them forces.

   THE SITUATION. A pending order (LIMIT or STOP) rests at `entry`. One bar
   later the OHLC shows the bar touched `entry` AND touched one of the exit
   levels. Four prices — open, high, low, close — cannot order those two
   touches, and the two orderings are not two flavours of one trade:

     (A) entry printed first  -> the order filled; the trade resolved as the
                                 walk scored it
     (B) the exit printed first -> the level came and went while the order
                                 was still resting. There was no trade, and
                                 the row should not be in the sample at all

   So the unknown is not "did this win or lose". It is "did this position
   ever exist", and the two candidate answers disagree about whether the row
   is a sample point.

   WHY THIS IS AN INTERVAL AND NOT A FILTER. Because (B) means "no trade",
   the choice per row is between the scored outcome and deletion — and which
   of those is favourable depends on what was scored:

     a scored WIN   (A) credits +2R      (B) removes it        -> (B) is worse
     a scored LOSS  (A) charges -1R      (B) removes it        -> (A) is worse

   There is therefore no single conservative filter, only two bounds:

     LOWER  take (B) for every unprovable win, (A) for every unprovable loss
     UPPER  take (A) for every unprovable win, (B) for every unprovable loss

   On the omnigold walk those bounds are 27.61% and 38.32% against a 33.33%
   breakeven at 2R. THE INTERVAL STRADDLES BREAKEVEN. On this evidence the
   book cannot be shown to win and cannot be shown to lose, and any single
   number quoted from it is a choice of bound wearing the clothes of a
   measurement.

   WHAT WENT WRONG HERE. scripts/backtest-omnigold.mjs flagged only the WIN
   side (`ambiguousSameBarWin`) and the evidence bake dropped rows carrying
   that flag. That combination computes the LOWER bound exactly — a
   defensible thing to compute, and nothing said it was a bound. It was
   reported as the mechanics' record and it condemned them: seventeen read
   "significantly below breakeven" at the lower bound, and NOT ONE fails at
   its upper bound. Symmetrically, eight clear the significance bar at the
   upper bound and not one clears it at the lower. Nothing is established in
   either direction, which is the finding the single number hid.

   THE RULE THIS IMPOSES. Condemn a mechanic only when it fails at its BEST
   case; credit one only when it holds at its WORST. Anything else is
   UNCHECKED with the interval shown. That is strictly weaker than what the
   desk used to claim, and it is what the data supports.

   NOT THE SAME AS hg-forward.js. That resolves a both-touch bar as a STOP,
   correctly: its case is an ALREADY-FILLED position whose stop and target
   both print inside one bar. The position certainly exists, only the exit
   is unknown, and the conservative exit is the stop. The case here is
   upstream — the entry itself is unproven — and deletion, not a stop, is
   the other branch.

   COLLAPSING THE INTERVAL. Only a finer series inside the fill bar can
   order the prints. scripts/resolve-unprovable-1m.mjs does exactly that and
   writes `unprovableFill: false` onto rows it settles, which narrows the
   interval for every consumer automatically. Until it has run over a walk,
   that walk's bounds are as wide as they look.

   The predicate derives from fields every emitter in this repo already
   writes, so artifacts baked before any of this classify identically. */

/* Order types that rest in the book rather than filling at the bar open. A
   market order fills at the open, so its entry print necessarily precedes
   everything else in its bar and nothing about it is unprovable. */
const PENDING_ORDER = /LIMIT|STOP/;

export function isPendingOrder(orderType){
  return PENDING_ORDER.test(String(orderType || ''));
}

export const isWinRow = r => /^win/.test(String(r && r.outcome));
export const isLossRow = r => /^loss/.test(String(r && r.outcome));

/* True when the bar data cannot establish that this position existed.

   An explicit flag wins over the derivation in BOTH directions, so a walk
   that has settled a row against 1m data can say so and have every consumer
   believe it. */
export function isUnprovableFill(row){
  if (!row) return false;
  if (row.unprovableFill === true) return true;
  if (row.unprovableFill === false) return false;
  return !!row.sameBarExit && isPendingOrder(row.orderType);
}

/* The row set for a given bound.

   'lower'  the book at its worst: unprovable wins never happened, unprovable
            losses did. This is what the repo used to compute and report as
            though it were the record.
   'upper'  the book at its best: unprovable wins happened, unprovable losses
            never did.
   'point'  every unprovable row dropped. NOT a bound — it assumes the
            unprovable rows would have resolved like the provable ones, and
            they are selected on resolving fast, so they would not. Offered
            because a midpoint is sometimes the honest thing to plot, never
            because it settles anything. */
export function boundRows(rows, bound){
  const rs = rows || [];
  if (bound === 'upper') return rs.filter(r => !(isUnprovableFill(r) && isLossRow(r)));
  if (bound === 'point') return rs.filter(r => !isUnprovableFill(r));
  return rs.filter(r => !(isUnprovableFill(r) && isWinRow(r)));   /* lower */
}

/* Win rate at each bound, plus the count of rows the ambiguity covers.
   Returns null rates rather than NaN when a bound has nothing settled in it,
   so a caller cannot print a number that was never computed. */
export function winRateBounds(rows){
  const rate = rs => {
    const w = rs.filter(isWinRow).length, l = rs.filter(isLossRow).length;
    return (w + l) ? w / (w + l) : null;
  };
  const rs = rows || [];
  const unprovable = rs.filter(isUnprovableFill);
  return {
    lower: rate(boundRows(rs, 'lower')),
    upper: rate(boundRows(rs, 'upper')),
    point: rate(boundRows(rs, 'point')),
    nLower: boundRows(rs, 'lower').length,
    nUpper: boundRows(rs, 'upper').length,
    unprovable: unprovable.length,
    unprovableScoredWins: unprovable.filter(isWinRow).length,
    unprovableScoredLosses: unprovable.filter(isLossRow).length,
    settled: rs.filter(r => isWinRow(r) || isLossRow(r)).length
  };
}

/* Where a threshold sits relative to the interval. This is the only function
   a gate should use to decide anything.

     'below'      even the LOWER bound clears it  -> established, worst case
     'above'      even the UPPER bound fails it   -> established, best case
     'straddles'  the interval contains it        -> nothing is established
     null         not enough rows to have bounds

   The asymmetry is deliberate: a claim in the desk's favour must survive the
   worst case, a condemnation must survive the best. */
export function thresholdVsInterval(rows, threshold){
  const b = winRateBounds(rows);
  if (b.lower == null || b.upper == null) return null;
  if (b.lower > threshold) return 'below';
  if (b.upper < threshold) return 'above';
  return 'straddles';
}

/* A one-line note for any report quoting a sample touched by this. Returns
   '' when nothing is unprovable, so a clean walk prints nothing rather than
   a reassurance nobody needs. */
export function unprovableNote(rows){
  const b = winRateBounds(rows);
  if (!b.unprovable) return '';
  const pct = x => (x == null ? '—' : (100 * x).toFixed(2) + '%');
  return b.unprovable + ' of ' + b.settled + ' settled rows ('
    + (100 * b.unprovable / Math.max(1, b.settled)).toFixed(1) + '%) are pending orders that '
    + 'resolved on their own fill bar, where the OHLC cannot show the entry printed before the '
    + 'exit. If the exit printed first the order was still resting and there was no trade, so each '
    + 'row is either what the walk scored (' + b.unprovableScoredWins + ' wins, '
    + b.unprovableScoredLosses + ' losses) or not a sample point at all. That puts the win rate '
    + 'between ' + pct(b.lower) + ' and ' + pct(b.upper) + ' — an interval, not a measurement. '
    + 'Only a finer series inside the fill bar can narrow it '
    + '(scripts/resolve-unprovable-1m.mjs).';
}

/* Back-compat for callers that just want the ambiguity out of the way and
   are reporting an interval elsewhere. Equivalent to the 'point' set, and
   named so nobody mistakes it for a bound. */
export function isProvableFill(row){ return !isUnprovableFill(row); }
export function partitionProvable(rows){
  const kept = [], withheld = [];
  for (const r of (rows || [])) (isUnprovableFill(r) ? withheld : kept).push(r);
  return { kept, withheld };
}
