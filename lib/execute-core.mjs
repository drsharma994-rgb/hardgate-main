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
  var out = {
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
  if (isFinite(plan.entry)) out.entry = +plan.entry;
  if (isFinite(plan.limitPrice)) out.limitPrice = +plan.limitPrice;
  return out;
}

export function hgExecuteCcxtConfigured(){
  return !!(process.env.EXECUTE_CCXT_EXCHANGE
    && process.env.EXECUTE_CCXT_API_KEY
    && (process.env.EXECUTE_CCXT_SECRET || process.env.EXECUTE_CCXT_API_SECRET));
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

/** Parse broker fill fields from an execute backend JSON body (optional). */
export function hgParseExecuteFillResponse(body){
  try{
    var j = (typeof body === 'string') ? JSON.parse(body) : body;
    if (!j || typeof j !== 'object') return null;
    var src = j.fill && typeof j.fill === 'object' ? j.fill : j;
    var filledQty = src.filledQty != null ? +src.filledQty
      : (src.filled_qty != null ? +src.filled_qty : (src.filled != null ? +src.filled : NaN));
    if (!(filledQty > 0)) return null;
    var qty = src.qty != null ? +src.qty : (src.orderQty != null ? +src.orderQty : NaN);
    var avgPrice = src.avgPrice != null ? +src.avgPrice : (src.avg_price != null ? +src.avg_price : NaN);
    var fillPct = src.fillPct != null ? +src.fillPct : (src.fill_pct != null ? +src.fill_pct : NaN);
    return {
      filledQty: filledQty,
      qty: isFinite(qty) && qty > 0 ? qty : undefined,
      avgPrice: isFinite(avgPrice) ? avgPrice : undefined,
      fillPct: isFinite(fillPct) ? fillPct : undefined,
      note: src.note ? String(src.note).slice(0, 200) : undefined,
    };
  }catch(e){ return null; }
}
