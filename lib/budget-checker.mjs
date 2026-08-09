/* HARDGATE — pre-trade budget lock (Hummingbot budget_checker pattern). */

export function hgBudgetLockState(){
  return { lockedUsd: 0, orders: [] };
}

/** Reserve notional for a pending slice; returns { ok, reason, lockId }. */
export function hgBudgetReserve(state, navUsd, notionalUsd, meta){
  state = state || hgBudgetLockState();
  navUsd = +navUsd;
  notionalUsd = +notionalUsd;
  if (!(navUsd > 0) || !(notionalUsd > 0)){
    return { ok: false, reason: 'invalid budget inputs', state: state };
  }
  if (state.lockedUsd + notionalUsd > navUsd * 1.05){
    return { ok: false, reason: 'budget exceeded: locked ' + state.lockedUsd.toFixed(0) + ' + ' + notionalUsd.toFixed(0) + ' > nav', state: state };
  }
  var lockId = 'lk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  state.lockedUsd += notionalUsd;
  state.orders.push({ id: lockId, notionalUsd: notionalUsd, meta: meta || null, at: Date.now() });
  return { ok: true, lockId: lockId, state: state };
}

export function hgBudgetRelease(state, lockId){
  if (!state || !lockId) return state;
  for (var i = 0; i < (state.orders || []).length; i++){
    var o = state.orders[i];
    if (o && o.id === lockId){
      state.lockedUsd = Math.max(0, (state.lockedUsd || 0) - (+o.notionalUsd || 0));
      state.orders.splice(i, 1);
      break;
    }
  }
  return state;
}
