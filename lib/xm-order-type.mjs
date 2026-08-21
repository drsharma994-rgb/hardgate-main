/* HARDGATE — XM pending vs market order type (pure).
   Shared by the live gold-lot sender and the OMNIGOLD bot backtest so the
   two cannot drift. */
export function xmOrderType(dir, entry, livePx){
  var long = dir !== 'short';
  var e = +entry;
  var live = +livePx;
  if (!isFinite(live) || live <= 0 || !isFinite(e) || e <= 0){
    return long
      ? { id: 2, name: 'BUY_LIMIT' }
      : { id: 3, name: 'SELL_LIMIT' };
  }
  var rel = Math.abs(e - live) / live;
  if (rel <= 0.0003){
    return long ? { id: 0, name: 'BUY' } : { id: 1, name: 'SELL' };
  }
  if (long){
    return e < live ? { id: 2, name: 'BUY_LIMIT' } : { id: 4, name: 'BUY_STOP' };
  }
  return e > live ? { id: 3, name: 'SELL_LIMIT' } : { id: 5, name: 'SELL_STOP' };
}
