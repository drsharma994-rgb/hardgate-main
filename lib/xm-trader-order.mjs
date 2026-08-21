/* HARDGATE — XM / MT5 order client (OMNIGOLD gold lots only).
   Candle fetch stays in xm-trader-fetch.mjs. This module talks to the same
   bridge URL (XM_MT5_URL) on common order routes. Many candle-only bridges
   have no trade endpoint — probe first and fail with bridge_has_no_order_route
   instead of pretending a 404 was a fill.
   Never logs the bearer token. */
import { xmTraderConfig } from './xm-trader-fetch.mjs';

const UPSTREAM_TIMEOUT_MS = 20000;
const ORDER_PATHS = [
  '/order',
  '/trade',
  '/api/order',
  '/api/trade',
  '/order/send',
  '/api/v1/order',
];

const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX_LIVE = 6;
const __liveHits = [];

function authHeaders(token){
  var h = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'HARDGATE/1.0 (+https://hardgate-main.onrender.com)',
  };
  if (token){
    h.Authorization = 'Bearer ' + token;
    h['X-API-Token'] = token;
  }
  return h;
}

function fetcher(fetchImpl){
  return (typeof fetchImpl === 'function') ? fetchImpl : globalThis.fetch;
}

async function upstream(url, token, init, fetchImpl){
  var f = fetcher(fetchImpl);
  if (typeof f !== 'function') return { ok: false, status: 0, reason: 'no fetch' };
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, UPSTREAM_TIMEOUT_MS);
  try{
    var res = await f(url, Object.assign({
      method: 'GET',
      signal: ctrl.signal,
      headers: authHeaders(token),
    }, init || {}));
    clearTimeout(timer);
    var text = '';
    try{ text = await res.text(); }catch(e){ text = ''; }
    var body = null;
    try{ body = text ? JSON.parse(text) : null; }catch(e){ body = null; }
    return {
      ok: !!res.ok,
      status: res.status || 0,
      text: String(text || '').slice(0, 800),
      body: body,
    };
  }catch(e){
    clearTimeout(timer);
    return { ok: false, status: 0, reason: (e && e.message) || 'fetch error' };
  }
}

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

export function xmOrderAccepted(status, body){
  if (!(status >= 200 && status < 300)) return false;
  if (body == null) return status === 200;
  if (typeof body !== 'object') return status === 200;
  if (body.ok === false) return false;
  if (body.error && !body.ok) return false;
  var rc = body.retcode != null ? +body.retcode
         : (body.retCode != null ? +body.retCode : NaN);
  if (isFinite(rc) && rc >= 10000){
    return rc === 10008 || rc === 10009 || rc === 10010;
  }
  return true;
}

export function xmOrderRateReset(){
  __liveHits.length = 0;
}

export function xmOrderRateAllow(now){
  now = now || Date.now();
  while (__liveHits.length && (now - __liveHits[0]) > RATE_WINDOW_MS) __liveHits.shift();
  if (__liveHits.length >= RATE_MAX_LIVE) return false;
  __liveHits.push(now);
  return true;
}

export async function xmProbeOrderRoute(cfg, fetchImpl){
  cfg = cfg || xmTraderConfig();
  if (!cfg.base) return { ok: false, reason: 'xm_not_configured' };
  var lastNet = 0;
  var i;
  for (i = 0; i < ORDER_PATHS.length; i++){
    var path = ORDER_PATHS[i];
    var up = await upstream(cfg.base + path, cfg.token, { method: 'GET' }, fetchImpl);
    if (up.status === 0){ lastNet++; continue; }
    if (up.status === 404) continue;
    return { ok: true, path: path, status: up.status };
  }
  if (lastNet === ORDER_PATHS.length){
    return { ok: false, reason: 'xm_bridge_unreachable' };
  }
  return { ok: false, reason: 'bridge_has_no_order_route' };
}

export async function xmPlaceOrder(order, opts){
  opts = opts || {};
  var cfg = opts.cfg || xmTraderConfig();
  var fetchImpl = opts.fetchImpl;
  if (!order || typeof order !== 'object'){
    return { ok: false, posted: false, reason: 'missing order' };
  }
  if (opts.dryRun){
    return { ok: true, dryRun: true, posted: false, order: order, reason: 'dry-run — not sent to XM' };
  }
  if (!cfg.base) return { ok: false, posted: false, reason: 'xm_not_configured' };
  if (!xmOrderRateAllow()){
    return { ok: false, posted: false, reason: 'XM live order rate limit (6 / 5 min)' };
  }
  var probe = await xmProbeOrderRoute(cfg, fetchImpl);
  if (!probe.ok) return { ok: false, posted: false, reason: probe.reason };
  var paths = [probe.path];
  var i;
  for (i = 0; i < ORDER_PATHS.length; i++){
    if (ORDER_PATHS[i] !== probe.path) paths.push(ORDER_PATHS[i]);
  }
  var last = { ok: false, posted: false, reason: 'bridge_has_no_order_route' };
  for (i = 0; i < paths.length; i++){
    var url = cfg.base + paths[i];
    var up = await upstream(url, cfg.token, {
      method: 'POST',
      headers: authHeaders(cfg.token),
      body: JSON.stringify(order),
    }, fetchImpl);
    if (up.status === 404) continue;
    last = {
      ok: xmOrderAccepted(up.status, up.body),
      posted: true,
      status: up.status,
      path: paths[i],
      order: order,
      response: up.body || { text: up.text },
      reason: xmOrderAccepted(up.status, up.body) ? undefined : (up.reason || ('HTTP ' + up.status)),
    };
    if (last.ok) return last;
    if (up.status === 401 || up.status === 403){
      last.reason = 'XM bridge unauthorized — check XM_MT5_TOKEN';
      return last;
    }
  }
  return last;
}

export { ORDER_PATHS as XM_ORDER_PATHS };
