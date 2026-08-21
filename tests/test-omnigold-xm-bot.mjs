/* HARDGATE — OMNIGOLD → XM gold-lot bot.
   Crypto execute.js / daemon CCXT stay disabled. This path is gold tickets
   only, dry-run unless XM_OMNIGOLD_LIVE=1.
   Run: node tests/test-omnigold-xm-bot.mjs */
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkApiAuth } from '../lib/api-auth.mjs';
import { createXmTraderApi } from '../lib/xm-trader-api.mjs';
import { xmOrderType, xmOrderAccepted, xmOrderRateReset, xmProbeOrderRoute } from '../lib/xm-trader-order.mjs';
import {
  ogXmTicketOk,
  ogXmBuildOrder,
  ogXmClipLots,
  ogXmBotCfg,
  ogXmBotStatus,
  ogXmExecuteTicket,
  ogXmExecuteTickets,
  ogXmIdempotencyClear,
  ogXmGoldSymbolOk,
} from '../lib/omnigold-xm-bot.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const ENV_KEYS = [
  'HARDGATE_API_SECRET', 'XM_MT5_URL', 'XM_MT5_TOKEN', 'XM_GOLD_SYMBOL',
  'XM_OMNIGOLD_LIVE', 'XM_OMNIGOLD_BOT', 'XM_OMNIGOLD_LOTS', 'XM_OMNIGOLD_MAX_LOTS',
  'XM_OMNIGOLD_MAX_TICKETS', 'HARDGATE_KILL_SWITCH', 'HARDGATE_TRADING_HALT',
];
const prevEnv = {};
for (const k of ENV_KEYS) prevEnv[k] = process.env[k];
function restoreEnv(){
  for (const k of ENV_KEYS){
    if (prevEnv[k] === undefined) delete process.env[k];
    else process.env[k] = prevEnv[k];
  }
}
function setEnv(patch){
  for (const k of ENV_KEYS){
    if (Object.prototype.hasOwnProperty.call(patch, k)){
      if (patch[k] == null) delete process.env[k];
      else process.env[k] = String(patch[k]);
    }
  }
}

function ticket(over){
  return Object.assign({
    source: 'OMNIGOLD',
    horizon: 'SCALP',
    kind: 'ASIA-BREAK',
    dir: 'long',
    ticket: true,
    grade: { ticket: true, vetoes: [] },
    plan: { entry: 2650, stop: 2640, t1: 2675, t2: 2690 },
    livePx: 2650.2,
  }, over || {});
}

function mockRes(){
  const res = { statusCode: 0, headers: {}, body: '' };
  res.setHeader = function(k, v){ res.headers[k] = v; };
  res.end = function(b){ res.body = b; };
  return res;
}
function mockReq(method, url, body, headers){
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = headers || {};
  const raw = body == null ? '' : (typeof body === 'string' ? body : JSON.stringify(body));
  queueMicrotask(function(){
    if (raw) req.emit('data', Buffer.from(raw));
    req.emit('end');
  });
  return req;
}

try {

console.log('== ticket gate: only OMNIGOLD TICKET rows ==');
{
  ok(ogXmTicketOk(ticket()), 'a grade.ticket row is sendable');
  ok(!ogXmTicketOk(null), 'null is not a ticket');
  ok(!ogXmTicketOk({ dir: 'long', plan: { entry: 1, stop: 0.5, t1: 2 } }), 'missing ticket flag is refused');
  ok(!ogXmTicketOk(ticket({ ticket: false, grade: { ticket: false, vetoes: [] } })), 'WATCH is refused');
  ok(!ogXmTicketOk(ticket({ ticket: false, grade: { ticket: false, vetoes: ['measured-edge'] } })), 'VETO is refused');
  ok(!ogXmTicketOk(ticket({ ticket: true, grade: { ticket: true, vetoes: ['weekend'] } })), 'ticket with vetoes is refused');
  ok(!ogXmTicketOk(ticket({ plan: { entry: 2650, stop: 2660, t1: 2675 } })), 'long with stop above entry is refused');
  ok(!ogXmTicketOk(ticket({ dir: 'short', plan: { entry: 2650, stop: 2640, t1: 2620 } })), 'short with stop below entry is refused');
  ok(ogXmTicketOk(ticket({ dir: 'short', plan: { entry: 2650, stop: 2660, t1: 2620 } })), 'short with stop above entry is sendable');
}

console.log('== lots clip + gold-only symbol ==');
{
  ok(ogXmClipLots(0.019, 0.10) === 0.01, 'lots round down to 0.01 step');
  ok(ogXmClipLots(0.5, 0.10) === 0.10, 'lots cap at max');
  ok(ogXmClipLots(0.004, 0.10) === 0, 'sub-0.01 lots are zero');
  ok(ogXmGoldSymbolOk('XAUUSD'), 'XAUUSD allowed');
  ok(ogXmGoldSymbolOk('GOLD'), 'GOLD alias allowed');
  ok(!ogXmGoldSymbolOk('BTCUSD'), 'crypto symbol refused');
}

console.log('== order mapping ==');
{
  const cfg = ogXmBotCfg({ XM_GOLD_SYMBOL: 'XAUUSD', XM_OMNIGOLD_LOTS: '0.02', XM_OMNIGOLD_MAX_LOTS: '0.10' });
  const built = ogXmBuildOrder(ticket(), cfg);
  ok(built.ok && built.order.symbol === 'XAUUSD', 'order uses XM gold symbol');
  ok(built.order.volume === 0.02, 'default lots from env');
  ok(built.order.sl === 2640 && built.order.tp === 2675, 'SL/TP from setup levels, not last close');
  ok(built.order.price === 2650, 'limit price is the setup entry');
  ok(built.order.side === 'long' && built.order.type === 'BUY', 'near-market long is BUY');
  ok(xmOrderType('long', 2600, 2650).name === 'BUY_LIMIT', 'pullback long is BUY_LIMIT');
  ok(xmOrderType('short', 2700, 2650).name === 'SELL_LIMIT', 'pullback short is SELL_LIMIT');
  ok(!ogXmBuildOrder(ticket({ symbol: 'ETHUSD' }), cfg).ok, 'ETH ticket is not built');
}

console.log('== dry-run never POSTs upstream ==');
{
  ogXmIdempotencyClear();
  xmOrderRateReset();
  let posts = 0;
  const fetchImpl = async function(){ posts++; return { ok: true, status: 200, text: async () => '{}' }; };
  const r = await ogXmExecuteTicket(ticket(), {
    env: { XM_MT5_URL: 'https://bridge.example', XM_OMNIGOLD_LIVE: '0', XM_OMNIGOLD_BOT: '1' },
    fetchImpl: fetchImpl,
  });
  ok(r.ok && r.dryRun === true && r.posted === false, 'dry-run reports ok without posting');
  ok(posts === 0, 'dry-run made zero upstream calls (got ' + posts + ')');
}

console.log('== live flag off is dry-run even if fetch would succeed ==');
{
  ogXmIdempotencyClear();
  const st = ogXmBotStatus({ XM_OMNIGOLD_LIVE: '0', XM_MT5_URL: 'https://bridge.example' });
  ok(st.live === false && st.dryRun === true, 'status defaults to dry-run');
}

console.log('== live kill switch blocks the POST ==');
{
  ogXmIdempotencyClear();
  xmOrderRateReset();
  let posts = 0;
  const fetchImpl = async function(url, init){
    if (init && init.method === 'POST') posts++;
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, retcode: 10009, order: 1 }) };
  };
  const r = await ogXmExecuteTicket(ticket(), {
    env: {
      XM_MT5_URL: 'https://bridge.example', XM_MT5_TOKEN: 'tok',
      XM_OMNIGOLD_LIVE: '1', HARDGATE_KILL_SWITCH: '1',
    },
    fetchImpl: fetchImpl,
  });
  ok(r.ok === false && r.posted === false, 'kill switch refuses live send');
  ok(/kill switch/i.test(r.reason || ''), 'reason names the kill switch');
  ok(posts === 0, 'kill switch made zero POSTs');
}

console.log('== trading halt blocks live send ==');
{
  ogXmIdempotencyClear();
  let posts = 0;
  const r = await ogXmExecuteTicket(ticket(), {
    env: {
      XM_MT5_URL: 'https://bridge.example', XM_OMNIGOLD_LIVE: '1', HARDGATE_TRADING_HALT: '1',
    },
    fetchImpl: async function(url, init){
      if (init && init.method === 'POST') posts++;
      return { ok: true, status: 200, text: async () => '{}' };
    },
  });
  ok(r.ok === false && posts === 0 && /halt/i.test(r.reason || ''), 'HARDGATE_TRADING_HALT blocks live');
}

console.log('== live send POSTs once and is idempotent ==');
{
  ogXmIdempotencyClear();
  xmOrderRateReset();
  const posts = [];
  const fetchImpl = async function(url, init){
    const method = (init && init.method) || 'GET';
    if (method === 'POST'){
      posts.push(String(url));
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, retcode: 10009, ticket: 77 }) };
    }
    if (String(url).endsWith('/order')){
      return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
    }
    return { ok: false, status: 404, text: async () => '' };
  };
  const env = { XM_MT5_URL: 'https://bridge.example', XM_MT5_TOKEN: 'tok', XM_OMNIGOLD_LIVE: '1' };
  const a = await ogXmExecuteTicket(ticket(), { env: env, fetchImpl: fetchImpl });
  ok(a.ok && a.posted === true && a.dryRun === false, 'live send posts and accepts retcode 10009');
  ok(posts.length === 1, 'exactly one live POST (got ' + posts.length + ')');
  const b = await ogXmExecuteTicket(ticket(), { env: env, fetchImpl: fetchImpl });
  ok(b.ok && posts.length === 1, 'same ticket retries do not POST again');
  const c = await ogXmExecuteTicket(ticket({ plan: { entry: 2650, stop: 2640, t1: 2800 } }), { env: env, fetchImpl: fetchImpl });
  ok(c.ok === false && /idempotency/i.test(c.reason || ''), 'same key with different TP is a conflict, not a second fill');
}

console.log('== candles-only bridge does not invent a fill ==');
{
  ogXmIdempotencyClear();
  xmOrderRateReset();
  const probe = await xmProbeOrderRoute(
    { base: 'https://bridge.example', token: '' },
    async function(){ return { ok: false, status: 404, text: async () => '' }; }
  );
  ok(probe.ok === false && probe.reason === 'bridge_has_no_order_route', 'all-404 probe is candles-only');
  ok(xmOrderAccepted(200, { ok: true, retcode: 10009 }) === true, 'MT5 DONE is accepted');
  ok(xmOrderAccepted(200, { ok: true, retcode: 10006 }) === false, 'MT5 reject is not a fill');
}

console.log('== POST /api/xm/order is fail-closed ==');
{
  restoreEnv();
  delete process.env.HARDGATE_API_SECRET;
  const handler = createXmTraderApi();
  const noSecret = mockRes();
  await handler(mockReq('POST', '/api/xm/order', { ticket: ticket() }, {}), noSecret);
  ok(noSecret.statusCode === 503, 'no HARDGATE_API_SECRET → 503 (got ' + noSecret.statusCode + ')');
  process.env.HARDGATE_API_SECRET = 'test-xm-secret';
  process.env.XM_MT5_URL = 'https://bridge.example';
  process.env.XM_OMNIGOLD_LIVE = '0';
  const badKey = mockRes();
  await handler(mockReq('POST', '/api/xm/order', { ticket: ticket() }, { 'x-hardgate-key': 'wrong' }), badKey);
  ok(badKey.statusCode === 401, 'wrong key → 401');
  ogXmIdempotencyClear();
  const dry = mockRes();
  await handler(mockReq('POST', '/api/xm/order', { ticket: ticket() }, { 'x-hardgate-key': 'test-xm-secret' }), dry);
  const dryJ = JSON.parse(dry.body || '{}');
  ok(dry.statusCode === 200 && dryJ.ok && dryJ.results && dryJ.results[0].dryRun === true,
     'authed dry-run returns 200 without live flag');
  const veto = mockRes();
  await handler(mockReq('POST', '/api/xm/order', {
    ticket: ticket({ ticket: false, grade: { ticket: false, vetoes: ['fade'] } }),
  }, { 'x-hardgate-key': 'test-xm-secret' }), veto);
  ok(veto.statusCode === 422, 'VETO ticket → 422 (got ' + veto.statusCode + ')');
  const empty = mockRes();
  await handler(mockReq('POST', '/api/xm/order', {}, { 'x-hardgate-key': 'test-xm-secret' }), empty);
  ok(empty.statusCode === 400, 'empty body → 400');
  const bot = mockRes();
  await handler(mockReq('GET', '/api/xm/bot'), bot);
  const botJ = JSON.parse(bot.body || '{}');
  ok(bot.statusCode === 200 && botJ.authRequired === true && botJ.live === false, 'GET /api/xm/bot is public status, live false');
  ok(checkApiAuth({ headers: { 'x-hardgate-key': 'test-xm-secret' } }).ok, 'auth helper still matches');
}

console.log('== crypto live path is still nailed shut ==');
{
  const exec = read('execute.js');
  const app = read('app.js');
  ok(/var HG_LIVE_TRADING_ENABLED = false;/.test(exec), 'execute.js live switch still false');
  ok(/const HG_DAEMON_EXECUTION_ENABLED = false;/.test(app), 'daemon CCXT still not constructed');
  ok(!/HG_LIVE_TRADING_ENABLED\s*=\s*true/.test(read('lib/omnigold-xm-bot.mjs')), 'XM bot does not flip crypto live');
}

console.log('== UI + wiring ==');
{
  const og = read('omnigold.js');
  const api = read('lib/xm-trader-api.mjs');
  const yaml = read('render.yaml');
  const agents = read('AGENTS.md');
  ok(/id="ogXmBot"/.test(og), 'OMNIGOLD mounts an XM bot panel');
  ok(/SEND STRONGEST TICKETS TO XM/.test(og), 'send-strongest control is on the tab');
  ok(/\/api\/xm\/order/.test(og), 'tab posts to /api/xm/order');
  ok(/hgApiHeaders/.test(og), 'tab sends the header API key');
  ok(/XM_OMNIGOLD_LIVE/.test(og), 'panel names the live env flag');
  ok(/createXmTraderApi/.test(read('scripts/server.mjs')), 'server still mounts /api/xm');
  ok(/\/api\/xm\/order/.test(api), 'API exposes POST /api/xm/order');
  ok(/checkApiAuth/.test(api), 'order route uses the mutating-API secret');
  ok(/XM_OMNIGOLD_LIVE/.test(yaml), 'render.yaml declares XM_OMNIGOLD_LIVE');
  ok(/XM_OMNIGOLD_LIVE/.test(agents), 'AGENTS.md documents the live flag');
  ok(!/XM_MT5_TOKEN\s*=\s*['"][^'"]+['"]/.test(og), 'no baked XM token in the tab');
}

} finally {
  restoreEnv();
  ogXmIdempotencyClear();
  xmOrderRateReset();
}

console.log('\n' + passed + ' passed, 0 failed');
