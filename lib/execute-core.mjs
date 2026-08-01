/* HARDGATE — bracket execution payload (shared client + server). */

export function hgBuildBracketPayload(plan){
  plan = plan || {};
  if (!plan.sym || !plan.side || !(plan.qty > 0)) return null;
  return {
    symbol: plan.sym,
    side: plan.side,
    qty: +plan.qty,
    leverage: isFinite(plan.lev) ? +plan.lev : undefined,
    bracket: {
      stop: +plan.stop,
      takeProfit: +plan.t1,
    },
    timestamp: isFinite(plan.timestamp) ? +plan.timestamp : Math.floor(Date.now() / 1000),
    source: plan.source || 'hardgate-trade-plan',
  };
}

export function hgExecuteBackendTarget(){
  return process.env.EXECUTE_BACKEND_URL
    || process.env.EXECUTE_WEBHOOK_URL
    || process.env.DELTA_EXECUTE_URL
    || '';
}

export function hgExecuteAuthHeader(){
  var key = process.env.EXECUTE_BACKEND_KEY || process.env.EXECUTE_WEBHOOK_KEY || '';
  return key ? { Authorization: 'Bearer ' + key } : {};
}
