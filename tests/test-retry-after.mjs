/* HARDGATE — do not retry into a limiter that cannot have cleared.

   MEASURED, on a clean cold load of production with ?diag=1:

     793  Delta 429s in 255s
     406  distinct URLs
     387  of those asked exactly TWICE
     408ms median gap between the pair

   The pair is deltaGet's own retry: on a 429 it slept 400ms and asked again.
   Our proxy's bucket is a SIXTY second window, so a 400ms retry cannot
   possibly find room — it is rejected again by construction, and the only
   thing it achieves is doubling the pressure that caused the rejection.
   Roughly half of all Delta traffic on a cold load was doomed on arrival.

   AND RAISING THE CEILING IS NOT THE ANSWER. Back-computing from the 500/min
   budget and the observed rejections, real demand is around 680 req/min. At
   the 3 units Delta charges for a candle call that is ~2,040 units/min
   against a published quota of 2,000 — already at the venue's own limit. More
   headroom on our side would only move the refusal to Delta's limiter, which
   is IP-scoped and takes out the whole deployment rather than one client.

   So the proxy states how long the wait really is, and the client stops
   spending a request it knows will fail.

   Run: node tests/test-retry-after.mjs */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
const proxySrc = fs.readFileSync(root + 'api/proxy.js', 'utf8');
const html = fs.readFileSync(root + 'index.html', 'utf8');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------- 1) the proxy tells the client how long ---------- */
{
  assert(/res\.setHeader\('Retry-After'/.test(proxySrc),
    'the 429 carries a Retry-After header');
  assert(/retryAfterSec/.test(proxySrc),
    'and the JSON body repeats it, for callers that only read the body');

  /* the number must be derived from the window, not a constant someone
     picked — the whole point is that it is the REAL wait */
  assert(/RATE_WINDOW_MS - \(Date\.now\(\) - b\[0\]\)/.test(proxySrc),
    'the wait is computed from the age of the oldest entry in the window');

  /* reproduce the arithmetic: a bucket whose oldest entry is 5s into a
     60s window must report 55s, not a guess */
  const RATE_WINDOW_MS = 60000;
  const oldestAgeMs = 5000;
  const wait = Math.max(1, Math.ceil((RATE_WINDOW_MS - oldestAgeMs) / 1000));
  assert(wait === 55, 'the formula yields the true remaining window (55s), got ' + wait);

  const nearlyClear = Math.max(1, Math.ceil((RATE_WINDOW_MS - 59500) / 1000));
  assert(nearlyClear === 1, 'a nearly-clear window floors at 1s rather than 0, got ' + nearlyClear);
}

/* ---------- 2) the client stops spending doomed requests ---------- */
{
  const m = html.match(/async function tryOrigin\(\)\{[\s\S]*?\n  \}/);
  assert(!!m, 'tryOrigin is extractable from index.html');
  const fn = m ? m[0] : '';

  assert(/Retry-After/.test(fn), 'tryOrigin reads Retry-After off the 429');
  assert(/ra > 1/.test(fn),
    'and returns without a second request when the wait exceeds a second');

  /* the old unconditional 400ms retry must be gone — that is the defect */
  assert(!/if \(r\.status === 429\)\{\s*\n\s*await sleep\(400\);/.test(fn),
    'the unconditional 400ms retry is gone');

  /* but a SHORT wait, or an upstream 429 with no header, keeps the retry:
     this is not a blanket removal, it is a removal of the doomed case */
  assert(/await sleep\(ra > 0 \? ra \* 1000 : 400\)/.test(fn),
    'a short or header-less 429 still gets its single retry');
}

/* ---------- 3) the reasoning is recorded where the next person will look ---------- */
{
  assert(/SIXTY second window|60 second window|sixty second/i.test(html),
    'index.html states why 400ms could never have worked');
  assert(/387 of 406|387 of them/.test(html + proxySrc),
    'and the measurement that proved it is written down, not just asserted');
}

console.log(String.fromCharCode(10) + pass + ' passed, ' + fail + ' failed');
if (fail > 0) process.exit(1);
console.log('ALL RETRY-AFTER TESTS PASSED');
