/* HARDGATE — liquidity-to-stop distance gate (pure). */

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

/** Sum resting USD notional on one side between price bounds. */
export function liquidityBetweenLevels(levels, side, fromPx, toPx){
  levels = Array.isArray(levels) ? levels : [];
  side = String(side || 'bid');
  var lo = Math.min(fromPx, toPx), hi = Math.max(fromPx, toPx);
  var usd = 0;
  for (var i = 0; i < levels.length; i++){
    var p = fin(levels[i][0]), q = fin(levels[i][1]);
    if (p === null || q === null) continue;
    if (p >= lo && p <= hi) usd += p * q;
  }
  return usd;
}

/** Path liquidity from entry toward stop on the adverse side. */
export function liquidityToStop(book, dir, entry, stop, positionUsd){
  try{
    dir = String(dir || '').toLowerCase();
    entry = fin(entry); stop = fin(stop); positionUsd = fin(positionUsd);
    if (!book || entry === null || stop === null) return null;
    var bids = book.bids || [], asks = book.asks || [];
    var pathUsd;
    if (dir === 'long'){
      pathUsd = liquidityBetweenLevels(bids, 'bid', entry, stop);
    } else if (dir === 'short'){
      pathUsd = liquidityBetweenLevels(asks, 'ask', entry, stop);
    } else return null;
    var ratio = (positionUsd && positionUsd > 0) ? pathUsd / positionUsd : null;
    var thin = (ratio !== null && ratio < 3);
    return {
      pathLiquidityUsd: pathUsd,
      positionUsd: positionUsd,
      ratio: ratio,
      thin: thin,
      slippageProne: thin,
      note: thin
        ? 'thin book — ' + (ratio !== null ? ratio.toFixed(1) : '?') + '× position in path to stop'
        : 'path liquidity OK — ' + (ratio !== null ? ratio.toFixed(1) : '?') + '× position',
    };
  }catch(e){ return null; }
}

/** Top-N book imbalance: bidUsd / askUsd. */
export function bookImbalance(book){
  if (!book) return null;
  var bid = fin(book.bidUsd), ask = fin(book.askUsd);
  if (bid === null || ask === null || !(ask > 0)) return null;
  var ratio = bid / ask;
  var extreme = (ratio >= 2 || ratio <= 0.5);
  var tag = null;
  if (ratio >= 2) tag = 'BID HEAVY';
  else if (ratio <= 0.5) tag = 'ASK HEAVY';
  return { ratio: ratio, extreme: extreme, tag: tag, bidUsd: bid, askUsd: ask };
}
