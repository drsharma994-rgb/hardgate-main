/* HARDGATE — TWAP + limit-chase execution wrapper (Hummingbot executor pattern). */

function sleep(ms){
  return new Promise(function(resolve){ setTimeout(resolve, ms); });
}

/**
 * Execute plan in TWAP slices.
 * opts: { slices, intervalMs, chase, chaseMaxSteps, chaseStepBps, budgetState, navUsd }
 */
export async function hgTwapExecute(executor, plan, opts){
  opts = opts || {};
  var slices = Math.max(1, Math.floor(+(opts.slices || plan.twapSlices || 1)));
  var intervalMs = Math.max(0, +(opts.intervalMs || plan.twapIntervalMs || 5000));
  var totalQty = +(plan.qty || plan.amount || 0);
  if (!(totalQty > 0)){
    return { success: false, error: 'TWAP requires qty' };
  }
  var perSlice = totalQty / slices;
  var results = [];
  var orderIds = [];

  for (var i = 0; i < slices; i++){
    var slicePlan = Object.assign({}, plan, { qty: perSlice, amount: perSlice });
    if (opts.chase && typeof executor.createLimitChase === 'function'){
      var cr = await executor.createLimitChase(slicePlan, opts.chase);
      results.push(cr);
    } else {
      var r = await executor.executeTrade(slicePlan);
      results.push(r);
    }
    if (results[results.length - 1] && results[results.length - 1].success){
      var oid = results[results.length - 1].orderId;
      if (oid) orderIds.push(oid);
    }
    if (i < slices - 1 && intervalMs > 0) await sleep(intervalMs);
  }

  var ok = results.some(function(x){ return x && x.success; });
  var filled = results.reduce(function(s, x){
    if (!x || !x.success) return s;
    return s + (+((x.fill && x.fill.filledQty) || x.size || 0));
  }, 0);

  return {
    success: ok,
    orderIds: orderIds,
    orderId: orderIds[0] || null,
    size: filled || totalQty,
    slices: slices,
    results: results,
    fill: { filledQty: filled, qty: totalQty, note: 'twap ' + slices + ' slices' },
  };
}
