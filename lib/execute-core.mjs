/* HARDGATE — bracket execution payload (shared client + server). */

export function hgExecuteIdempotencyKey(plan){
  plan = plan || {};
  if (plan.idempotencyKey){
    return String(plan.idempotencyKey).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  }
  var bucket = Math.floor(Date.now() / 60000);
  var raw = [
    plan.sym || plan.symbol || '',
    plan.side || plan.dir || '',
    plan.qty,
    plan.stop != null ? plan.stop : (plan.bracket && plan.bracket.stop),
    plan.t1 != null ? plan.t1 : (plan.bracket && plan.bracket.takeProfit),
    plan.t2 != null ? plan.t2 : (plan.bracket && plan.bracket.takeProfit2),
    plan.positionId || '',
    bucket,
  ].join('|');
  var h = 0;
  for (var i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  return 'hgx-' + Math.abs(h).toString(36) + '-' + bucket;
}

export function hgBuildBracketPayload(plan){
  plan = plan || {};
  if (!plan.sym || !plan.side || !(plan.qty > 0)) return null;
  var idem = hgExecuteIdempotencyKey(plan);
  var bracket = { stop: +plan.stop, takeProfit: +plan.t1 };
  if (isFinite(plan.t2)) bracket.takeProfit2 = +plan.t2;
  return {
    symbol: plan.sym,
    side: plan.side,
    qty: +plan.qty,
    leverage: isFinite(plan.lev) ? +plan.lev : undefined,
    bracket: bracket,
    timestamp: isFinite(plan.timestamp) ? +plan.timestamp : Math.floor(Date.now() / 1000),
    source: plan.source || 'hardgate-trade-plan',
    idempotencyKey: idem,
    positionId: plan.positionId || undefined,
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
