/* HARDGATE — depth-aware VWAP clip sizing (Hummingbot simple_vwap pattern). */

export function hgVwapClipSize(depthBids, depthAsks, side, targetNotional, maxSpreadBps){
  targetNotional = +targetNotional;
  if (!(targetNotional > 0)) return { qty: 0, note: 'no target' };
  side = String(side || 'long').toLowerCase();
  var book = side === 'long' ? (depthAsks || []) : (depthBids || []);
  if (!book.length) return { qty: 0, note: 'empty book' };

  var best = +book[0][0];
  if (!(best > 0)) return { qty: 0, note: 'bad best' };
  var filledUsd = 0, qty = 0;
  for (var i = 0; i < book.length; i++){
    var px = +book[i][0], sz = +book[i][1];
    if (!(px > 0 && sz > 0)) continue;
    if (maxSpreadBps != null && isFinite(+maxSpreadBps)){
      var bps = Math.abs(px - best) / best * 10000;
      if (bps > +maxSpreadBps) break;
    }
    var levelUsd = px * sz;
    var need = targetNotional - filledUsd;
    if (need <= 0) break;
    if (levelUsd >= need){
      qty += need / px;
      filledUsd += need;
      break;
    }
    qty += sz;
    filledUsd += levelUsd;
  }
  return {
    qty: qty,
    filledUsd: filledUsd,
    avgPx: qty > 0 ? filledUsd / qty : null,
    note: filledUsd >= targetNotional * 0.95 ? 'filled' : 'partial',
  };
}

/** Scale plan qty from order book snapshot. */
export function hgApplyVwapSizing(plan, orderBook, opts){
  opts = opts || {};
  if (!orderBook || !plan) return plan;
  var entry = +(plan.entry || plan.limitPrice || 0);
  var notional = +(plan.qty || 0) * (entry > 0 ? entry : 1);
  if (!(notional > 0) && plan.notionalUsd) notional = +plan.notionalUsd;
  var clip = hgVwapClipSize(orderBook.bids, orderBook.asks, plan.side || plan.dir, notional, opts.maxSpreadBps || 25);
  if (!(clip.qty > 0)) return plan;
  return Object.assign({}, plan, { qty: clip.qty, vwapNote: clip.note, vwapFilledUsd: clip.filledUsd });
}
