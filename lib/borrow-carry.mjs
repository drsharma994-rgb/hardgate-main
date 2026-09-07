/* HARDGATE — net carry after spot borrow cost (pure). */

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

/** Annualize a daily borrow rate (fraction, e.g. 0.0001 = 0.01%/day). */
export function borrowAnnualizePct(dailyRateFrac){
  var r = fin(dailyRateFrac);
  if (r === null) return null;
  return r * 365 * 100; /* percent APR */
}

/** Net carry APR = funding APR − borrow APR on the spot short leg. */
export function carryNetApr(fundingAprPct, borrowAprPct){
  var f = fin(fundingAprPct), b = fin(borrowAprPct);
  if (f === null) return null;
  if (b === null) return { netApr: f, grossApr: f, borrowApr: null, borrowAssumed: true };
  return { netApr: f - b, grossApr: f, borrowApr: b, borrowAssumed: false };
}

/** Pick best available borrow APR for a base asset. */
export function borrowBestApr(base, sources){
  base = String(base || '').toUpperCase();
  sources = sources || {};
  var bin = sources.binance && sources.binance[base];
  var aave = sources.aave && sources.aave[base];
  var out = null;
  if (bin && isFinite(bin.aprPct)) out = bin.aprPct;
  if (aave && isFinite(aave.aprPct)){
    out = (out === null) ? aave.aprPct : Math.max(out, aave.aprPct);
  }
  return out;
}
