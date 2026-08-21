/* HARDGATE — OMNIGOLD ticket → XM gold lots.
   Separate from crypto execute.js / daemon CCXT. Default DRY RUN.
   Live requires XM_OMNIGOLD_LIVE=1 AND kill switch off AND a ticket (not
   WATCH / VETO). Credentials stay in env (XM_MT5_URL / XM_MT5_TOKEN). */
import { xmOrderType, xmPlaceOrder, xmOrderRateReset } from './xm-trader-order.mjs';
import { apiSecret } from './api-auth.mjs';

const IDEMP_TTL_MS = 24 * 60 * 60 * 1000;
const __idemp = new Map();
var __last = null;

function envOn(env, key, defaultVal){
  env = env || process.env;
  if (env[key] == null || env[key] === '') return !!defaultVal;
  var v = String(env[key]).toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return !!defaultVal;
}

function num(v){
  var n = +v;
  return isFinite(n) ? n : NaN;
}

export function ogXmClipLots(n, maxLots){
  var max = isFinite(+maxLots) && +maxLots > 0 ? +maxLots : 0.10;
  var x = Math.floor((+n) * 100 + 1e-9) / 100;
  if (!(x >= 0.01)) return 0;
  if (x > max) x = Math.floor(max * 100 + 1e-9) / 100;
  return x;
}

export function ogXmBotCfg(env){
  env = env || process.env;
  var base = String(env.XM_MT5_URL || env.XM_TRADERS_URL || '').replace(/\/+$/, '');
  var token = env.XM_MT5_TOKEN || env.XM_TRADERS_TOKEN || '';
  var lots = num(env.XM_OMNIGOLD_LOTS);
  if (!(lots >= 0.01)) lots = 0.01;
  var maxLots = num(env.XM_OMNIGOLD_MAX_LOTS);
  if (!(maxLots >= 0.01)) maxLots = 0.10;
  if (maxLots < lots) maxLots = lots;
  var maxTickets = Math.max(1, Math.min(4, +(env.XM_OMNIGOLD_MAX_TICKETS || 2) || 2));
  var deviation = num(env.XM_OMNIGOLD_DEVIATION);
  if (!(deviation >= 1)) deviation = 30;
  var kill = envOn(env, 'HARDGATE_KILL_SWITCH', false);
  var halt = envOn(env, 'HARDGATE_TRADING_HALT', false);
  var live = envOn(env, 'XM_OMNIGOLD_LIVE', false);
  var botEnabled = envOn(env, 'XM_OMNIGOLD_BOT', true);
  var symbol = (env.XM_GOLD_SYMBOL || env.XM_TRADERS_SYMBOL || 'XAUUSD').trim() || 'XAUUSD';
  return {
    base: base,
    token: token,
    tokenSet: !!token,
    symbol: symbol,
    configured: !!base,
    botEnabled: botEnabled,
    live: live,
    dryRun: !live,
    lots: ogXmClipLots(lots, maxLots) || 0.01,
    maxLots: maxLots,
    maxTickets: maxTickets,
    deviation: deviation,
    killSwitch: kill,
    tradingHalt: halt,
    halted: kill || halt,
    authRequired: true,
    authConfigured: !!apiSecret(),
  };
}

export function ogXmTicketOk(cand){
  if (!cand || typeof cand !== 'object') return false;
  var ticket = cand.ticket === true || !!(cand.grade && cand.grade.ticket === true);
  if (!ticket) return false;
  if (cand.grade && Array.isArray(cand.grade.vetoes) && cand.grade.vetoes.length){
    return false;
  }
  var dir = cand.dir === 'short' ? 'short' : (cand.dir === 'long' ? 'long' : '');
  if (!dir) return false;
  var plan = cand.plan;
  if (!plan) return false;
  var e = num(plan.entry);
  var s = num(plan.stop);
  var t = num(plan.t1);
  if (!(e > 0 && s > 0 && t > 0)) return false;
  if (dir === 'long' && !(s < e && t > e)) return false;
  if (dir === 'short' && !(s > e && t < e)) return false;
  return true;
}

export function ogXmIdempotencyKey(cand){
  var plan = (cand && cand.plan) || {};
  var e = num(plan.entry);
  var s = num(plan.stop);
  return 'ogxm:v1:'
    + String((cand && cand.horizon) || '') + ':'
    + String((cand && cand.kind) || '') + ':'
    + String((cand && cand.dir) || '') + ':'
    + (isFinite(e) ? e.toFixed(2) : 'na') + ':'
    + (isFinite(s) ? s.toFixed(2) : 'na');
}

function payloadHash(order){
  return JSON.stringify({
    symbol: order.symbol,
    volume: order.volume,
    type: order.type,
    price: order.price,
    sl: order.sl,
    tp: order.tp,
  });
}

function xmComment(cand){
  var h = String((cand && cand.horizon) || 'GOLD').replace(/[^A-Za-z0-9]/g, '').slice(0, 5);
  var k = String((cand && cand.kind) || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 12);
  return ('HG OG ' + h + ' ' + k).trim().slice(0, 31);
}

export function ogXmGoldSymbolOk(sym, cfg){
  cfg = cfg || ogXmBotCfg();
  var s = String(sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return true;
  var want = String(cfg.symbol || 'XAUUSD').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s === want) return true;
  if ((s === 'XAUUSD' || s === 'GOLD' || s === 'XAUUSDT') &&
      (want === 'XAUUSD' || want === 'GOLD' || want === 'XAUUSDT')) return true;
  return false;
}

export function ogXmBuildOrder(cand, cfg){
  cfg = cfg || ogXmBotCfg();
  if (!ogXmTicketOk(cand)) return { ok: false, reason: 'not an OMNIGOLD ticket' };
  if (cand.symbol && !ogXmGoldSymbolOk(cand.symbol, cfg)){
    return { ok: false, reason: 'XM bot only sends gold (XAUUSD / GOLD)' };
  }
  var lots = ogXmClipLots(cand.volume != null ? cand.volume : cfg.lots, cfg.maxLots);
  if (!(lots >= 0.01)) return { ok: false, reason: 'lots below 0.01' };
  var plan = cand.plan;
  var dir = cand.dir === 'short' ? 'short' : 'long';
  var entry = num(plan.entry);
  var stop = num(plan.stop);
  var t1 = num(plan.t1);
  var ot = xmOrderType(dir, entry, cand.livePx);
  var order = {
    symbol: cfg.symbol,
    volume: lots,
    side: dir,
    type: ot.name,
    type_id: ot.id,
    action: ot.name,
    price: entry,
    sl: stop,
    tp: t1,
    deviation: cfg.deviation,
    magic: 433,
    comment: xmComment(cand),
    source: 'OMNIGOLD',
    horizon: cand.horizon || '',
    kind: cand.kind || '',
  };
  if (isFinite(num(plan.t2))) order.tp2 = num(plan.t2);
  return {
    ok: true,
    order: order,
    idempotencyKey: ogXmIdempotencyKey(cand),
  };
}

function pruneIdemp(now){
  now = now || Date.now();
  __idemp.forEach(function(row, key){
    if (now - row.at > IDEMP_TTL_MS) __idemp.delete(key);
  });
}

export function ogXmIdempotencyClear(){
  __idemp.clear();
}

export function ogXmLastEvent(){
  return __last;
}

function setLast(ev){
  __last = ev;
  return ev;
}

export function ogXmBotStatus(env){
  var cfg = ogXmBotCfg(env);
  return {
    ok: true,
    configured: cfg.configured,
    tokenSet: cfg.tokenSet,
    symbol: cfg.symbol,
    botEnabled: cfg.botEnabled,
    live: cfg.live,
    dryRun: cfg.dryRun,
    lots: cfg.lots,
    maxLots: cfg.maxLots,
    maxTickets: cfg.maxTickets,
    killSwitch: cfg.killSwitch,
    tradingHalt: cfg.tradingHalt,
    halted: cfg.halted,
    authRequired: true,
    authConfigured: cfg.authConfigured,
    routes: ['/api/xm/status', '/api/xm/bot', '/api/xm/order'],
    last: __last,
    note: cfg.live
      ? 'LIVE gold lots — OMNIGOLD tickets only'
      : 'DRY RUN — set XM_OMNIGOLD_LIVE=1 on the server to send lots to XM',
  };
}

function logEvent(fields){
  try{
    var row = Object.assign({ event: 'xm_omnigold_order' }, fields || {});
    delete row.token;
    delete row.authorization;
    console.log(JSON.stringify(row));
  }catch(e){}
}

export async function ogXmExecuteTicket(cand, opts){
  opts = opts || {};
  var env = opts.env || process.env;
  var cfg = ogXmBotCfg(env);
  if (!cfg.botEnabled){
    return setLast({ ok: false, posted: false, reason: 'xm omnigold bot disabled (XM_OMNIGOLD_BOT=0)' });
  }
  var built = ogXmBuildOrder(cand, cfg);
  if (!built.ok) return setLast({ ok: false, posted: false, reason: built.reason });
  var dryRun = opts.dryRun != null ? !!opts.dryRun : cfg.dryRun;
  if (!dryRun && cfg.halted){
    return setLast({
      ok: false, posted: false, dryRun: false, halted: true,
      reason: cfg.killSwitch
        ? 'manual kill switch (HARDGATE_KILL_SWITCH=1)'
        : 'trading halt (HARDGATE_TRADING_HALT=1)',
      order: built.order,
    });
  }
  pruneIdemp();
  var key = built.idempotencyKey;
  var hash = payloadHash(built.order);
  var prev = __idemp.get(key);
  if (prev && (Date.now() - prev.at) <= IDEMP_TTL_MS){
    if (prev.hash !== hash){
      return setLast({ ok: false, posted: false, reason: 'idempotency key reused with a different payload' });
    }
    return prev.response;
  }
  var xmCfg = { base: cfg.base, token: (opts.token != null ? opts.token : cfg.token), symbol: cfg.symbol };
  var placed = await xmPlaceOrder(built.order, {
    dryRun: dryRun,
    cfg: xmCfg,
    fetchImpl: opts.fetchImpl,
  });
  var out = {
    ok: !!placed.ok,
    dryRun: !!dryRun,
    posted: !!placed.posted,
    reason: placed.reason,
    order: built.order,
    idempotencyKey: key,
    path: placed.path,
    status: placed.status,
    response: placed.response,
    kind: cand.kind,
    horizon: cand.horizon,
    dir: cand.dir,
  };
  if (placed.ok){
    __idemp.set(key, { hash: hash, response: out, at: Date.now() });
    if (__idemp.size > 200){
      var oldest = __idemp.keys().next().value;
      __idemp.delete(oldest);
    }
  }
  logEvent({
    dryRun: out.dryRun, posted: out.posted, ok: out.ok,
    symbol: built.order.symbol, side: built.order.side, volume: built.order.volume,
    kind: cand.kind, horizon: cand.horizon, reason: out.reason || 'ok',
  });
  return setLast(out);
}

export async function ogXmExecuteTickets(cands, opts){
  opts = opts || {};
  var env = opts.env || process.env;
  var cfg = ogXmBotCfg(env);
  var list = Array.isArray(cands) ? cands : [];
  if (!list.length) return { ok: false, reason: 'no tickets', results: [] };
  if (list.length > cfg.maxTickets){
    return { ok: false, reason: 'too many tickets (max ' + cfg.maxTickets + ')', results: [] };
  }
  var results = [];
  var i;
  for (i = 0; i < list.length; i++){
    results.push(await ogXmExecuteTicket(list[i], opts));
  }
  var anyFail = results.some(function(r){ return !r || !r.ok; });
  return { ok: !anyFail, results: results, dryRun: results[0] && results[0].dryRun };
}

export { xmOrderRateReset };
