/* HARDGATE — composite order book fill simulation for paperbook (Hummingbot paper_trade idea). */

/** Simulate market fill against depth levels. */
export function hgCompositeFill(side, qty, depthBids, depthAsks){
  qty = +qty;
  if (!(qty > 0)) return { filled: 0, avgPx: null, note: 'zero qty' };
  side = String(side || 'long').toLowerCase();
  var book = side === 'long' ? (depthAsks || []) : (depthBids || []);
  var remain = qty, cost = 0;
  for (var i = 0; i < book.length; i++){
    var px = +book[i][0], sz = +book[i][1];
    if (!(px > 0 && sz > 0)) continue;
    var take = Math.min(remain, sz);
    cost += take * px;
    remain -= take;
    if (remain <= 1e-12) break;
  }
  var filled = qty - remain;
  return {
    filled: filled,
    avgPx: filled > 0 ? cost / filled : null,
    partial: remain > 1e-12,
    note: remain > 1e-12 ? 'partial composite fill' : 'composite fill',
  };
}

/** Apply composite fill to paperbook mark/fill price. */
export function hgPaperbookCompositePx(intent, orderBook){
  if (!intent || !orderBook) return null;
  var fill = hgCompositeFill(intent.dir || intent.side, intent.qty || intent.size, orderBook.bids, orderBook.asks);
  return fill.avgPx;
}
