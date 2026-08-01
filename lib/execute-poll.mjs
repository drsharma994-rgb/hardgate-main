/* HARDGATE — broker fill status polling via execute backend. */
import { hgExecuteBackendTarget, hgExecuteAuthHeader, hgParseExecuteFillResponse } from './execute-core.mjs';

export function hgExecuteFillPollTarget(){
  if (process.env.EXECUTE_FILL_POLL_URL) return process.env.EXECUTE_FILL_POLL_URL;
  var base = hgExecuteBackendTarget();
  if (!base) return '';
  if (/\/execute\/?$/i.test(base)) return base.replace(/\/execute\/?$/i, '/fill-status');
  try{
    var u = new URL(base);
    return u.origin + '/fill-status';
  }catch(e){
    return String(base).replace(/\/?$/, '') + '/fill-status';
  }
}

export function hgBuildFillPollQuery(query){
  query = query || {};
  var mark = isFinite(query.mark) && query.mark > 0 ? +query.mark : NaN;
  var notional = isFinite(query.notionalUsd) ? +query.notionalUsd : NaN;
  var qty = isFinite(query.qty) && query.qty > 0 ? +query.qty
    : (isFinite(mark) && isFinite(notional) && mark > 0 ? notional / mark : NaN);
  return {
    positionId: query.positionId ? String(query.positionId) : undefined,
    idempotencyKey: query.idempotencyKey ? String(query.idempotencyKey) : undefined,
    symbol: query.sym || query.symbol,
    side: query.side || query.dir,
    qty: isFinite(qty) && qty > 0 ? qty : undefined,
  };
}

async function readResponse(res){
  var text = '';
  try{ text = await res.text(); }catch(e){}
  return { status: res.status, ok: res.ok, text: text };
}

export async function hgPollExecuteFill(query){
  var target = hgExecuteFillPollTarget();
  if (!target) return { ok: false, reason: 'fill poll not configured — set EXECUTE_BACKEND_URL or EXECUTE_FILL_POLL_URL' };
  var body = hgBuildFillPollQuery(query);
  if (!body.positionId && !body.idempotencyKey){
    return { ok: false, reason: 'positionId or idempotencyKey required' };
  }
  var headers = Object.assign({ 'Content-Type': 'application/json' }, hgExecuteAuthHeader());
  if (body.idempotencyKey) headers['Idempotency-Key'] = body.idempotencyKey;

  try{
    var postRes = await fetch(target, { method: 'POST', headers: headers, body: JSON.stringify(body) });
    var post = await readResponse(postRes);
    var fill = hgParseExecuteFillResponse(post.text);
    if (fill) return { ok: true, fill: fill, status: post.status, response: post.text.slice(0, 500) };
    if (post.ok) return { ok: false, reason: 'no fill in response', status: post.status, response: post.text.slice(0, 500) };
    if (post.status !== 404 && post.status !== 405){
      return { ok: false, reason: 'backend error', status: post.status, response: post.text.slice(0, 500) };
    }
  }catch(e){
    var msg = (e && e.message) || 'fetch error';
    return { ok: false, reason: msg };
  }

  try{
    var params = new URLSearchParams();
    if (body.positionId) params.set('positionId', body.positionId);
    if (body.idempotencyKey) params.set('idempotencyKey', body.idempotencyKey);
    if (body.symbol) params.set('symbol', body.symbol);
    if (body.side) params.set('side', body.side);
    if (body.qty) params.set('qty', String(body.qty));
    var getUrl = target + (target.indexOf('?') >= 0 ? '&' : '?') + params.toString();
    var getRes = await fetch(getUrl, { method: 'GET', headers: hgExecuteAuthHeader() });
    var get = await readResponse(getRes);
    var fillGet = hgParseExecuteFillResponse(get.text);
    if (fillGet) return { ok: true, fill: fillGet, status: get.status, response: get.text.slice(0, 500) };
    return { ok: false, reason: 'no fill in response', status: get.status, response: (get.text || '').slice(0, 500) };
  }catch(e2){
    return { ok: false, reason: (e2 && e2.message) || 'fetch error' };
  }
}
