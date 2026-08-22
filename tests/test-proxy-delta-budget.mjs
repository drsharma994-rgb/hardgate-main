/* HARDGATE — Delta gets its own proxy budget, sized from Delta's own limits.

   THE DEFECT THIS GUARDS.
   api/proxy.js gave CoinDCX and Binance each a named rate ceiling and left
   Delta India — the venue in this app's own title — falling through to
   RATE_MAX_DEFAULT. It was the only host the desk rate-limited itself
   against. Measured on the deployed desk, one QUICK RESCAN at the fetch layer
   (not performance.getEntriesByType, which silently caps at 250 entries and
   dropped 1,707 of 1,957 requests when this was first looked at):

       1,957 fetches / 100s,  219 rejected
       219 of 219 were  429 api.india.delta.exchange  — from OUR proxy
       observed demand ~430 Delta requests/min against a 300/min ceiling

   THE CEILING IS ARITHMETIC, NOT TASTE, AND THAT IS WHAT THIS FILE PINS.
   Delta documents 10,000 units per fixed 5-minute window, throttled by IP for
   unauthenticated requests — 2,000 units/min. /v2/history/candles and
   /v2/tickers cost 3 units each and are substantially all a scan asks for, so
   Delta itself starts refusing at about 2000/3 = 666 requests/min.

   A future edit that raises this "a bit more" to chase throughput would move
   the refusal from our 429 to Delta's — and theirs is IP-scoped, so it takes
   out the whole deployment rather than one client. The test therefore asserts
   a CORRIDOR: above the shared default because Delta is a primary venue,
   and safely below Delta's own ceiling.

   Run: node tests/test-proxy-delta-budget.mjs */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const PROXY = fs.readFileSync(root + 'api/proxy.js', 'utf8');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function constOf(name){
  const m = new RegExp('const ' + name + ' = (\\d+)').exec(PROXY);
  return m ? +m[1] : null;
}

/* Delta's published budget, and what it means in requests for the two
   endpoints a scan actually uses. Kept as named numbers so the reasoning is
   visible at the point of failure rather than buried in a comment. */
const DELTA_UNITS_PER_5MIN = 10000;
const DELTA_UNITS_PER_MIN  = DELTA_UNITS_PER_5MIN / 5;          // 2000
const CANDLE_UNIT_COST     = 3;                                  // candles + tickers
const DELTA_REQ_CEILING    = Math.floor(DELTA_UNITS_PER_MIN / CANDLE_UNIT_COST); // 666

/* ---------- 1) Delta has a bucket at all ---------- */
{
  const delta = constOf('RATE_MAX_DELTA');
  assert(delta !== null, 'api/proxy.js declares RATE_MAX_DELTA');
  assert(/indexOf\('delta\.exchange'\) !== -1\) \? RATE_MAX_DELTA/.test(PROXY),
    'and the limiter actually selects it for delta.exchange hosts');

  /* the selector must be reached — a bucket declared but ordered after the
     catch-all would be dead code that reads as fixed */
  const sel = PROXY.slice(PROXY.indexOf('const max ='), PROXY.indexOf('let bucket'));
  assert(sel.indexOf('RATE_MAX_DELTA') < sel.indexOf('RATE_MAX_DEFAULT'),
    'the Delta branch is evaluated before the catch-all default');
}

/* ---------- 2) the corridor: above the default, below Delta's own limit ---------- */
{
  const delta = constOf('RATE_MAX_DELTA');
  const def = constOf('RATE_MAX_DEFAULT');

  assert(delta > def,
    'Delta is a primary venue and is budgeted above the shared default (' + delta + ' > ' + def + ')');

  assert(delta > 430,
    'the budget covers the ~430 req/min a real rescan was measured to want (got ' + delta + ')');

  assert(delta < DELTA_REQ_CEILING,
    'and stays UNDER Delta\'s own ' + DELTA_REQ_CEILING + ' req/min ceiling (10,000 units / 5min at '
      + CANDLE_UNIT_COST + ' units per candle call) — got ' + delta);

  /* headroom, stated as a fraction so the intent survives a future retune:
     we deliberately do not run right up against the venue's limit */
  const usedUnits = delta * CANDLE_UNIT_COST;
  assert(usedUnits <= DELTA_UNITS_PER_MIN * 0.8,
    'worst-case unit spend leaves >=20% headroom on Delta\'s quota ('
      + usedUnits + ' of ' + DELTA_UNITS_PER_MIN + ' units/min)');
}

/* ---------- 3) the other venues are untouched ---------- */
{
  assert(constOf('RATE_MAX_COINDCX') === 800, 'CoinDCX ceiling unchanged at 800/min');
  assert(constOf('RATE_MAX_BINANCE') === 900, 'Binance ceiling unchanged at 900/min');
  assert(constOf('RATE_MAX_DEFAULT') === 300, 'the shared default is unchanged at 300/min');
  assert(constOf('RATE_WINDOW_MS') === 60000, 'the window is still one minute — the ceilings are per-minute');
}

/* ---------- 4) the cache still short-circuits ahead of the limiter ---------- */
{
  /* a cache hit must never consume budget, or a repeated URL would burn the
     ceiling it was meant to avoid */
  const cacheAt = PROXY.indexOf('const cached = cacheGet(');
  const limitAt = PROXY.indexOf('if (rateLimited(');
  assert(cacheAt > 0 && limitAt > 0 && cacheAt < limitAt,
    'the response cache is consulted BEFORE the rate limiter, so hits cost no budget');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
console.log('ALL PROXY DELTA BUDGET TESTS PASSED');
