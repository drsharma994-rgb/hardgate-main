/* HARDGATE — triple-barrier exits: SL / TP / time / trailing (StockSharp/Hummingbot pattern). */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Trailing stop price from peak/trough and trail distance. */
export function hgTrailingStop(side, peak, trough, trailDist){
  side = String(side || 'long').toLowerCase();
  trailDist = num(trailDist);
  if (trailDist == null || !(trailDist > 0)) return null;
  if (side === 'long' && peak != null) return peak - trailDist;
  if (side === 'short' && trough != null) return trough + trailDist;
  return null;
}

/**
 * Evaluate barrier hit on a bar {o,h,l,c} for open position.
 * Returns { hit: 'sl'|'tp'|'time'|null, px, note }
 */
export function hgTripleBarrierBar(side, bar, pos){
  side = String(side || pos.dir || 'long').toLowerCase();
  var entry = num(pos.entry);
  var stop = num(pos.stop);
  var tp = num(pos.tp || pos.t1);
  var barsHeld = num(pos.barsHeld) || 0;
  var maxBars = num(pos.maxBars);
  if (!bar || entry == null) return { hit: null };

  var peak = num(pos.peak) != null ? num(pos.peak) : bar.h;
  var trough = num(pos.trough) != null ? num(pos.trough) : bar.l;
  if (side === 'long'){
    if (bar.h > peak) peak = bar.h;
    if (bar.l < trough) trough = bar.l;
  } else {
    if (bar.h > peak) peak = bar.h;
    if (bar.l < trough) trough = bar.l;
  }

  var trail = num(pos.trailDist);
  if (trail != null && trail > 0){
    var ts = hgTrailingStop(side, peak, trough, trail);
    if (ts != null) stop = side === 'long' ? Math.max(stop || -Infinity, ts) : Math.min(stop || Infinity, ts);
  }

  if (side === 'long'){
    if (stop != null && bar.l <= stop) return { hit: 'sl', px: stop, peak: peak, trough: trough };
    if (tp != null && bar.h >= tp) return { hit: 'tp', px: tp, peak: peak, trough: trough };
  } else {
    if (stop != null && bar.h >= stop) return { hit: 'sl', px: stop, peak: peak, trough: trough };
    if (tp != null && bar.l <= tp) return { hit: 'tp', px: tp, peak: peak, trough: trough };
  }
  if (maxBars != null && barsHeld >= maxBars){
    return { hit: 'time', px: bar.c, peak: peak, trough: trough, note: 'maxBars ' + maxBars };
  }
  return { hit: null, peak: peak, trough: trough };
}

/** Should daemon invalidate conviction on time barrier? */
export function hgTimeBarrierExpired(setup, barIndex){
  if (!setup) return false;
  var max = num(setup.maxBarsToTp1);
  var start = num(setup.executionBarIndex) || 0;
  var now = num(barIndex) || 0;
  if (max == null || max <= 0) return false;
  return (now - start) >= max;
}
