/* HARDGATE — LP digest schedule + delivery tests */
import {
  lpDigestDue, LP_DIGEST_HOUR_UTC, LP_DIGEST_MIN_UTC, LP_DIGEST_DOW_UTC,
  LP_DIGEST_MIN_INTERVAL_MS,
} from '../lib/paperbook-core.mjs';
import {
  digestChannelsReady, digestCronAuthOk, deliverLpDigest,
} from '../lib/paperbook-digest.mjs';
import { pbNewBook } from '../lib/paperbook-core.mjs';

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

function atUtc(dow, h, m){
  var base = Date.UTC(2026, 7, 2, 12, 0, 0);
  var d = new Date(base);
  while (d.getUTCDay() !== dow) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(h, m, 0, 0);
  return d.getTime();
}

ok(LP_DIGEST_DOW_UTC === 0, 'weekly digest on Sunday UTC');
ok(lpDigestDue(undefined, atUtc(0, LP_DIGEST_HOUR_UTC, LP_DIGEST_MIN_UTC + 5)) === true,
  'first weekly digest inside window -> due');
ok(lpDigestDue(undefined, atUtc(1, LP_DIGEST_HOUR_UTC, LP_DIGEST_MIN_UTC + 5)) === false,
  'Monday -> not due');
ok(lpDigestDue(new Date(atUtc(0, LP_DIGEST_HOUR_UTC, LP_DIGEST_MIN_UTC + 1)).toISOString(),
  atUtc(0, LP_DIGEST_HOUR_UTC, LP_DIGEST_MIN_UTC + 10)) === false,
  'same-week stamp -> suppressed');
ok(lpDigestDue(new Date(atUtc(0, LP_DIGEST_HOUR_UTC, LP_DIGEST_MIN_UTC + 1) - LP_DIGEST_MIN_INTERVAL_MS - 1000).toISOString(),
  atUtc(0, LP_DIGEST_HOUR_UTC, LP_DIGEST_MIN_UTC + 10)) === true,
  '7d-old stamp -> due again');

var prevHook = process.env.LP_DIGEST_WEBHOOK_URL;
var prevFetch = globalThis.fetch;
process.env.LP_DIGEST_WEBHOOK_URL = 'http://127.0.0.1:9/hook';
globalThis.fetch = async function(url, opts){
  if (String(url).indexOf('/hook') >= 0) return { ok: true, status: 200, text: async function(){ return 'ok'; } };
  return prevFetch(url, opts);
};
var sent = await deliverLpDigest(pbNewBook(), 'week');
ok(sent.ok && sent.digest.period === 'week', 'deliverLpDigest webhook ok');
globalThis.fetch = prevFetch;
process.env.LP_DIGEST_WEBHOOK_URL = prevHook;

var reqLocal = { socket: { remoteAddress: '127.0.0.1' }, headers: {} };
var reqRemote = { socket: { remoteAddress: '8.8.8.8' }, headers: {} };
process.env.BOOK_DIGEST_CRON_SECRET = 'sekrit';
ok(digestCronAuthOk(reqLocal) === true, 'localhost cron auth ok');
ok(digestCronAuthOk(Object.assign({}, reqRemote, { headers: { 'x-book-digest-key': 'sekrit' } })) === true,
  'remote with key ok');
ok(digestCronAuthOk(reqRemote) === false, 'remote without key blocked');
delete process.env.BOOK_DIGEST_CRON_SECRET;
ok(digestCronAuthOk(reqRemote) === true, 'open cron when secret unset');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
