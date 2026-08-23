/* HARDGATE — a candle window that moves every second can never be cached.

   THE DEFECT.
   Candle URLs carried end=nowSec(). Every request was therefore a unique URL,
   which silently defeated THREE layers at once:

     - the proxy's response cache, keyed by URL;
     - the in-flight coalescing added in v431, keyed by URL;
     - the browser's own HTTP cache.

   CoinDCX candles even had a 45s TTL configured at the proxy that could
   essentially never hit, and Delta was not in the cacheable list at all.

   MEASURED on a cold production load: ~2,900 Delta requests for ~393 distinct
   (symbol, timeframe) reads. A 7x amplification, because SWING, SCALP, BEST,
   BRAIN and EDGE each scan the same universe and not one of their identical
   reads could collapse into another's. That amplification — not the size of
   the universe — is why Delta's own limiter was refusing the desk.

   WHY THIS IS NOT A COVERAGE CUT. Every removed request is a duplicate of one
   already in flight or already answered. No symbol is dropped, no timeframe is
   dropped, no bar goes unread. The window is floored, never rounded up, so it
   can never claim data that does not exist yet.

   Run: node tests/test-candle-window-cache.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const html = fs.readFileSync(root + 'index.html', 'utf8');
const proxySrc = fs.readFileSync(root + 'api/proxy.js', 'utf8');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------- 1) the quantiser itself ---------- */
{
  const ctx = vm.createContext(Object.assign(Object.create(null), {
    console, setTimeout, clearTimeout, Promise, Date, Math, JSON, isFinite, window: {}
  }));
  vm.runInContext(fs.readFileSync(root + 'xuniverse.js', 'utf8'), ctx, { filename: 'xuniverse.js' });
  const q = ctx.window.hgCandleWindowEnd;
  assert(typeof q === 'function', 'xuniverse.js exports hgCandleWindowEnd for the inline readers');

  const a = q();
  assert(a % 60 === 0, 'the window end lands on a minute boundary (got ' + a + ')');

  const now = Math.floor(Date.now() / 1000);
  assert(a <= now, 'it FLOORS — the window never claims data that does not exist yet');
  assert(now - a < 60, 'and is never more than a grain behind (got ' + (now - a) + 's)');

  /* the whole point: two reads in the same minute produce the same value, so
     two identical logical reads produce the same URL */
  assert(q() === a, 'two calls within the same minute agree, so the URL is stable');
}

/* ---------- 2) every candle caller uses it ---------- */
{
  /* the defect written out: a per-second window in a candle URL builder */
  const perSecond = /const (end|to) = nowSec\(\), (start|from) =/g;
  const hits = (html.match(perSecond) || []).length;
  assert(hits === 0,
    'no inline candle builder still takes its window from a per-second clock (found ' + hits + ')');

  assert(/hgCandleWindowEnd\(\) : nowSec\(\)/.test(html),
    'the inline builders use the shared quantiser, with a nowSec fallback if it is absent');

  const xu = fs.readFileSync(root + 'xuniverse.js', 'utf8');
  const xuPerSecond = (xu.match(/var (end|to) = nowSec\(\), /g) || []).length;
  assert(xuPerSecond === 0,
    'xuCandles does not build its window from a per-second clock either (found ' + xuPerSecond + ')');
}

/* ---------- 3) a stable URL is useless if nothing caches it ---------- */
{
  assert(/function deltaCacheTtl/.test(proxySrc),
    'api/proxy.js gives Delta a cache TTL — it had none, so every read spent budget');
  assert(/delta = deltaCacheTtl\(urlStr\)/.test(proxySrc),
    'and proxyCacheTtl actually consults it');

  /* reproduce the routing decisions rather than trusting the source read */
  const m = proxySrc.match(/function deltaCacheTtl\(urlStr\)\{[\s\S]*?\n\}/);
  assert(!!m, 'deltaCacheTtl is extractable');
  const ctx = vm.createContext({ console });
  vm.runInContext(m[0], ctx, { filename: 'deltaCacheTtl.js' });
  const ttl = ctx.deltaCacheTtl;

  assert(ttl('https://api.india.delta.exchange/v2/history/candles?symbol=BTCUSD') === 45000,
    'Delta candles cache for 45s, matching the CoinDCX candle TTL');
  assert(ttl('https://api.india.delta.exchange/v2/tickers?contract_types=perpetual_futures') === 30000,
    'Delta tickers cache for 30s');
  assert(ttl('https://api.india.delta.exchange/v2/orderbook?symbol=BTCUSD') === 0,
    'anything else on Delta stays uncached — this is not a blanket TTL');
  assert(ttl('https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT') === 0,
    'and it only claims Delta URLs');
}

/* ---------- 4) the cache must be consulted BEFORE the limiter ---------- */
{
  /* a cache hit that still spends rate-limit budget would defeat the entire
     point of the change */
  const cacheAt = proxySrc.indexOf('const cached = cacheGet(');
  const limitAt = proxySrc.indexOf('if (rateLimited(');
  assert(cacheAt > 0 && limitAt > 0 && cacheAt < limitAt,
    'the response cache is checked before the rate limiter, so hits cost no budget');
}

console.log(String.fromCharCode(10) + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
console.log('ALL CANDLE WINDOW CACHE TESTS PASSED');
