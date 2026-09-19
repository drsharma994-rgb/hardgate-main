/* HARDGATE — one gold order is POSTed once, and a failure does not spend the
   live-order budget.

   xmPlaceOrder knows six possible route names on the MT5 bridge — /order,
   /trade, /api/order, /api/trade, /order/send, /api/v1/order — because
   different bridges expose different ones. It probes to find a live route,
   then posts the order to it.

   TWO THINGS WERE WRONG WITH THAT, both on the live-order path.

   The loop fell through to the next route name on ANY failure, not just on a
   404. Measured against a bridge answering 500: the same order was POSTed to
   all six names. Most bridges map several of those onto one handler, so a
   transient 5xx AFTER the broker had accepted could leave several live gold
   positions from a single ticket. The idempotency map in omnigold-xm-bot.mjs
   sits above this and only records on success, so it cannot suppress them
   either. A 404 means the route is absent. Everything else means something
   went wrong, which is not the same thing — and the probe has already done
   the discovering.

   And xmOrderRateAllow() records a hit as it answers, and was called BEFORE
   the route probe. A bridge that was unreachable therefore burned the budget:
   measured against a dead bridge, six of eight attempts spent a slot and the
   last two were refused for rate limiting — with not one order placed. A cap
   on live orders had become a cap on failures, locking the desk out for five
   minutes at the moment the bridge came back. The probe goes first now.

   What must NOT change is pinned here too: a genuinely absent route is still
   skipped, a bridge exposing only a later name is still found, an unauthorized
   bridge still stops immediately, and six live orders in five minutes is still
   the ceiling.

   Run: node tests/test-xm-order-post-once.mjs */
import { xmPlaceOrder, xmOrderRateReset, XM_ORDER_PATHS } from '../lib/xm-trader-order.mjs';

let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const ORDER = { symbol: 'XAUUSD', volume: 0.01, type: 'BUY_LIMIT', price: 4020, sl: 3995, tp: 4070 };
const CFG = { base: 'https://bridge.example', token: 'tok', symbol: 'XAUUSD' };

/* a bridge whose live routes and POST answer we choose */
function bridge(liveRoutes, postStatus, postBody){
  const posts = [], gets = [];
  const impl = async (url, init) => {
    const method = (init && init.method) || 'GET';
    const path = url.replace(CFG.base, '');
    const exists = liveRoutes.indexOf(path) >= 0;
    if (method === 'GET'){ gets.push(path); return { ok: exists, status: exists ? 200 : 404,
                                                     json: async () => ({ ok: exists }), text: async () => '{}' }; }
    posts.push(path);
    if (!exists) return { ok: false, status: 404, json: async () => ({ ok: false }), text: async () => 'no route' };
    const st = postStatus == null ? 200 : postStatus;
    const body = postBody === undefined ? { ok: st < 300, retcode: st < 300 ? 10009 : 10013 } : postBody;
    return { ok: st < 300, status: st, json: async () => body, text: async () => JSON.stringify(body) };
  };
  return { posts, gets, impl };
}

console.log('== the bridge really does have six possible names ==');
{
  ok(XM_ORDER_PATHS.length === 6, `${XM_ORDER_PATHS.length} route names: ${XM_ORDER_PATHS.join(' ')}`);
}

console.log('== a failed POST is not re-sent under another name ==');
{
  for (const [status, body, label] of [
      [500, undefined, 'a 500'],
      [502, undefined, 'a 502'],
      [400, undefined, 'a 400'],
      [409, undefined, 'a 409 conflict'],
      [200, { ok: false, error: 'rejected' }, 'a 200 whose body says not ok'],
      [200, { ok: true, retcode: 10013 }, 'a 200 carrying a refusing retcode']]){
    xmOrderRateReset();
    const b = bridge(XM_ORDER_PATHS.slice(), status, body);
    const r = await xmPlaceOrder(ORDER, { cfg: CFG, fetchImpl: b.impl });
    ok(b.posts.length === 1,
       `${label} produces one POST of the order — it produced ${b.posts.length}, and used to produce ${XM_ORDER_PATHS.length}`);
    ok(r.ok === false, 'and it is reported as not ok');
  }
}

console.log('\n== while a 404 still means "try the next name" ==');
{
  xmOrderRateReset();
  /* the probe finds /order, but POSTing there 404s; /trade takes it */
  const posts = [];
  const impl = async (url, init) => {
    const method = (init && init.method) || 'GET';
    const path = url.replace(CFG.base, '');
    if (method === 'GET') return { ok: true, status: (path === '/order' || path === '/trade') ? 200 : 404,
                                   json: async () => ({}), text: async () => '{}' };
    posts.push(path);
    if (path === '/order') return { ok: false, status: 404, json: async () => ({}), text: async () => 'gone' };
    return { ok: true, status: 200, json: async () => ({ ok: true, retcode: 10009 }), text: async () => '{}' };
  };
  const r = await xmPlaceOrder(ORDER, { cfg: CFG, fetchImpl: impl });
  ok(r.ok === true && r.path === '/trade', `a 404 on the probed route falls through and lands on ${r.path}`);
  ok(posts.length === 2, `with ${posts.length} POSTs — the absent one and the real one, no more`);
}

console.log('\n== and a bridge that only exposes a later name is still found ==');
{
  for (const only of ['/api/order', '/order/send', '/api/v1/order']){
    xmOrderRateReset();
    const b = bridge([only]);
    const r = await xmPlaceOrder(ORDER, { cfg: CFG, fetchImpl: b.impl });
    ok(r.ok === true && r.path === only, `a bridge exposing only ${only} is found and used`);
    ok(b.posts.length === 1, `and posted to once (${b.posts.join(', ')})`);
  }
}

console.log('\n== a success stops there, and an unauthorized bridge stops harder ==');
{
  xmOrderRateReset();
  const good = bridge(XM_ORDER_PATHS.slice());
  const r = await xmPlaceOrder(ORDER, { cfg: CFG, fetchImpl: good.impl });
  ok(r.ok === true && good.posts.length === 1, `an accepted order is POSTed exactly once (${good.posts.join(', ')})`);

  xmOrderRateReset();
  const denied = bridge(XM_ORDER_PATHS.slice(), 401);
  const d = await xmPlaceOrder(ORDER, { cfg: CFG, fetchImpl: denied.impl });
  ok(!d.ok && denied.posts.length === 1, 'a 401 POSTs once');
  ok(/unauthorized/i.test(d.reason || ''), `and says what to fix (${d.reason})`);
}

console.log('\n== the live-order budget is spent on orders, not on failures ==');
{
  xmOrderRateReset();
  const dead = async () => ({ ok: false, status: 0, json: async () => null, text: async () => '' });
  let rateRefused = 0;
  for (let i = 0; i < 10; i++){
    const r = await xmPlaceOrder(ORDER, { cfg: CFG, fetchImpl: dead });
    if (/rate limit/i.test(r.reason || '')) rateRefused++;
  }
  ok(rateRefused === 0,
     `ten attempts against an unreachable bridge spend no budget — ${rateRefused} refused for rate limiting`);

  /* and the same for a bridge that is up but has no order route at all */
  xmOrderRateReset();
  const noRoute = bridge([]);
  let noRouteRefused = 0;
  for (let i = 0; i < 10; i++){
    const r = await xmPlaceOrder(ORDER, { cfg: CFG, fetchImpl: noRoute.impl });
    if (/rate limit/i.test(r.reason || '')) noRouteRefused++;
  }
  ok(noRouteRefused === 0, 'and nor does a bridge that is up but exposes no order route');
}

console.log('\n== but six live orders in five minutes is still the ceiling ==');
{
  xmOrderRateReset();
  let posted = 0, capped = 0;
  for (let i = 0; i < 10; i++){
    const b = bridge(XM_ORDER_PATHS.slice());
    const r = await xmPlaceOrder(ORDER, { cfg: CFG, fetchImpl: b.impl });
    if (/rate limit/i.test(r.reason || '')) capped++; else posted += b.posts.length;
  }
  ok(posted === 6, `ten attempts against a working bridge post ${posted} orders`);
  ok(capped === 4, `and the remaining ${capped} are refused by the cap`);
}

console.log('\n== a dry run never reaches any of this ==');
{
  xmOrderRateReset();
  const b = bridge(XM_ORDER_PATHS.slice());
  const r = await xmPlaceOrder(ORDER, { cfg: CFG, fetchImpl: b.impl, dryRun: true });
  ok(r.ok === true && r.dryRun === true && r.posted === false, 'a dry run reports ok, dryRun, not posted');
  ok(b.posts.length === 0 && b.gets.length === 0, 'and touches the bridge zero times, probe included');
}

console.log('\n' + passed + ' passed, 0 failed');
