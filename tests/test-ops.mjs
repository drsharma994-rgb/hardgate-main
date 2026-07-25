/* HARDGATE — ops files test. Covers the files owned by the ops track:
     api/proxy.js                allowlist, CORS, passthrough, error mapping
     scripts/alert-check.mjs     heartbeat + window.__hgLastEmail gate helpers
     vercel.json / .vercelignore / alert-state.json / alert-notify.yml sanity
   No network, no puppeteer — the proxy's global fetch is stubbed.
   Run: node tests/test-ops.mjs */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { needsHeartbeat, emailVerdict, HEARTBEAT_MS,
         ticketSnapshot, ticketChanged, ticketPushBody, sendTicketPush, sendNtfy,
         sendTelegramCi, sendAlertCi,
         engineVerdict, engineAlertDue, ENGINE_STALE_MS, ENGINE_ALERT_MS,
         fallbackLegs } from '../scripts/alert-check.mjs';

const require = createRequire(import.meta.url);
const proxy = require('../api/proxy.js');

let pass = 0, fail = 0;
function ok(cond, name){
  if (cond){ pass++; console.log('ok   - ' + name); }
  else { fail++; console.log('FAIL - ' + name); }
}

function mockRes(){
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v){ this.headers[k.toLowerCase()] = v; },
    end(b){ this.body = b; },
  };
}

async function withFetch(stub, fn){
  const orig = globalThis.fetch;
  globalThis.fetch = stub;
  try { await fn(); } finally { globalThis.fetch = orig; }
}

function fetchOk(body, status, ct){
  return async (url, opts) => ({
    status: status || 200,
    text: async () => body,
    headers: { get: (k) => (k === 'content-type' ? (ct || 'application/json') : null) },
  });
}

/* ---------------- api/proxy.js ---------------- */

// OPTIONS preflight -> 204 + ACAO + allow methods/headers
{
  const res = mockRes();
  await proxy({ method: 'OPTIONS' }, res);
  ok(res.statusCode === 204, 'proxy OPTIONS -> 204');
  ok(res.headers['access-control-allow-origin'] === '*', 'proxy OPTIONS sets ACAO *');
  ok(/GET/.test(res.headers['access-control-allow-methods'] || ''), 'proxy OPTIONS allows GET');
  ok(typeof res.headers['access-control-allow-headers'] === 'string', 'proxy OPTIONS sets allow-headers');
}

// missing url -> 400 JSON
{
  const res = mockRes();
  await proxy({ method: 'GET', query: {} }, res);
  ok(res.statusCode === 400, 'proxy missing url -> 400');
  ok(typeof JSON.parse(res.body).error === 'string', 'proxy missing url -> JSON error');
}

// invalid url -> 400
{
  const res = mockRes();
  await proxy({ method: 'GET', query: { url: 'not a url' } }, res);
  ok(res.statusCode === 400, 'proxy invalid url -> 400');
}

// non-allowlisted host -> 403 {error:'host not allowed'}, upstream never called
await withFetch(fetchOk('{}'), async () => {
  const res = mockRes();
  await proxy({ method: 'GET', query: { url: 'https://evil.example.com/steal' } }, res);
  ok(res.statusCode === 403, 'proxy foreign host -> 403');
  ok(JSON.parse(res.body).error === 'host not allowed', 'proxy foreign host -> exact error message');
});

// allowlisted host over plain http -> 403 (https only)
{
  const res = mockRes();
  await proxy({ method: 'GET', query: { url: 'http://api.coindcx.com/x' } }, res);
  ok(res.statusCode === 403, 'proxy http:// on allowlisted host -> 403');
}

// non-GET -> 405
{
  const res = mockRes();
  await proxy({ method: 'POST', query: { url: 'https://api.coindcx.com/x' } }, res);
  ok(res.statusCode === 405, 'proxy POST -> 405');
}

// every allowlisted host passes + passthrough status/body/headers
for (const host of ['api.coindcx.com', 'public.coindcx.com', 'query1.finance.yahoo.com', 'query2.finance.yahoo.com']){
  let sawSignal = false, sawGet = false;
  await withFetch(async (url, opts) => {
    sawSignal = opts && opts.signal instanceof AbortSignal;
    sawGet = !opts || !opts.method || opts.method === 'GET';
    return { status: 200, text: async () => '{"ok":1}', headers: { get: () => 'application/json' } };
  }, async () => {
    const res = mockRes();
    await proxy({ method: 'GET', query: { url: 'https://' + host + '/some/path?x=1' } }, res);
    ok(res.statusCode === 200 && res.body === '{"ok":1}', 'proxy passes ' + host);
    ok(res.headers['access-control-allow-origin'] === '*'
      && res.headers['cache-control'] === 's-maxage=30, stale-while-revalidate=60',
       'proxy sets ACAO + Cache-Control for ' + host);
    ok(res.headers['content-type'] === 'application/json', 'proxy forwards content-type for ' + host);
    ok(sawSignal && sawGet, 'proxy forwards GET with AbortSignal for ' + host);
  });
}

// upstream non-200 passes through untouched
await withFetch(fetchOk('{"e":"rate limited"}', 429), async () => {
  const res = mockRes();
  await proxy({ method: 'GET', query: { url: 'https://api.coindcx.com/x' } }, res);
  ok(res.statusCode === 429 && res.body === '{"e":"rate limited"}', 'proxy passes upstream 429 through');
});

// req.url fallback parsing (plain-node style request, no req.query)
await withFetch(fetchOk('[1,2,3]'), async () => {
  const res = mockRes();
  await proxy({ method: 'GET', url: '/api/proxy?url=' + encodeURIComponent('https://public.coindcx.com/market_data/v3/current_prices/futures/rt') }, res);
  ok(res.statusCode === 200 && res.body === '[1,2,3]', 'proxy parses url from req.url when req.query absent');
});

// upstream throw -> 502 JSON
await withFetch(async () => { throw new Error('socket hangup'); }, async () => {
  const res = mockRes();
  await proxy({ method: 'GET', query: { url: 'https://api.coindcx.com/x' } }, res);
  ok(res.statusCode === 502, 'proxy upstream failure -> 502');
  ok(JSON.parse(res.body).error === 'socket hangup', 'proxy 502 carries error message');
});

// abort -> 502 timeout message
await withFetch(async () => { const e = new Error('The operation was aborted'); e.name = 'AbortError'; throw e; }, async () => {
  const res = mockRes();
  await proxy({ method: 'GET', query: { url: 'https://api.coindcx.com/x' } }, res);
  ok(res.statusCode === 502 && /timeout/.test(JSON.parse(res.body).error), 'proxy abort -> 502 timeout message');
});

/* ---------------- scripts/alert-check.mjs helpers ---------------- */

{
  const now = Date.now();
  ok(needsHeartbeat({}, now) === true, 'heartbeat: missing lastRunAt -> stamp');
  ok(needsHeartbeat({ lastRunAt: 'garbage' }, now) === true, 'heartbeat: unparseable lastRunAt -> stamp');
  ok(needsHeartbeat({ lastRunAt: new Date(now - HEARTBEAT_MS - 3600000).toISOString() }, now) === true, 'heartbeat: 25h old -> stamp');
  ok(needsHeartbeat({ lastRunAt: new Date(now - 3600000).toISOString() }, now) === false, 'heartbeat: 1h old -> keep');
  ok(needsHeartbeat({ lastRunAt: new Date(now + 3600000).toISOString() }, now) === false, 'heartbeat: future stamp (clock skew) -> keep');
}

{
  const miss = emailVerdict(null);
  ok(miss.fail === false && miss.warn === true, 'email gate: missing __hgLastEmail -> warn only');
  ok(emailVerdict(undefined).warn === true, 'email gate: undefined -> warn only');
  ok(emailVerdict({ ok: 'yes' }).warn === true, 'email gate: malformed ok -> warn only');
  ok(emailVerdict({ ok: true, err: null, ts: 1 }).fail === false, 'email gate: ok:true -> pass');
  const bad = emailVerdict({ ok: false, err: 'Invalid grant', ts: 1 });
  ok(bad.fail === true && bad.err === 'Invalid grant', 'email gate: ok:false -> fail with err');
  ok(emailVerdict({ ok: false }).err === 'unknown error', 'email gate: ok:false without err -> fallback message');
}

/* ---------------- alert-check.mjs ticket helpers ---------------- */

{
  const a = { long: { sym: 'BTC', entry: 100 }, short: null };
  ok(JSON.stringify(ticketSnapshot(a)) === JSON.stringify(a), 'ticket: snapshot normalizes a clean state verbatim');
  ok(ticketSnapshot(null).long === null && ticketSnapshot(undefined).short === null,
     'ticket: null/garbage input -> both sides null, never throws');
  ok(ticketSnapshot({ long: { sym: 'X', entry: 'oops' }, short: { entry: 5 } }).long === null
     && ticketSnapshot({ long: { sym: 'X', entry: 'oops' }, short: { entry: 5 } }).short === null,
     'ticket: non-finite entry or missing sym -> side null, never fabricated');
  ok(ticketChanged(a, { long: { sym: 'BTC', entry: 100 }, short: null }) === false,
     'ticket: identical state -> unchanged');
  ok(ticketChanged(a, { long: { sym: 'BTC', entry: 101 }, short: null }) === true,
     'ticket: moved entry -> changed');
  ok(ticketChanged(a, { long: { sym: 'BTC', entry: 100 }, short: { sym: 'ACE', entry: 0.085 } }) === true,
     'ticket: side appearing -> changed');
  ok(ticketChanged(a, { long: null, short: null }) === true,
     'ticket: side vanishing -> changed');
  ok(ticketPushBody(a).indexOf('BTC @ 100') >= 0 && ticketPushBody(a).indexOf('Short: —') >= 0,
     'ticket: push body names the levels, empty side shown as —');
  const skip = await sendTicketPush('', a);
  ok(typeof skip === 'string' && skip.indexOf('skipped') === 0, 'ticket: no NTFY_TOPIC -> honest skip, no network');
  let failed; await withFetch(async () => { throw new Error('offline'); }, async () => { failed = await sendTicketPush('t', a); });
  ok(typeof failed === 'string' && failed.indexOf('failed') === 0, 'ticket: ntfy network error -> honest failure string — got ' + JSON.stringify(failed));
  let sent; await withFetch(fetchOk('{}', 202), async () => { sent = await sendTicketPush('t', a); });
  ok(sent === 'sent', 'ticket: ntfy 2xx -> sent — got ' + JSON.stringify(sent));

  /* sendNtfy is the shared channel — same contract, custom title/body */
  const skip2 = await sendNtfy('', 't', 'b');
  ok(typeof skip2 === 'string' && skip2.indexOf('skipped') === 0, 'ntfy: no topic -> honest skip, no network');
  let sent2, captured = null;
  await withFetch(async (url, opts) => { captured = { url, opts }; return fetchOk('{}', 200)(url, opts); },
    async () => { sent2 = await sendNtfy('mytopic', 'Custom Title', 'Custom Body'); });
  ok(sent2 === 'sent' && captured && captured.opts.headers.Title === 'Custom Title'
     && captured.opts.body === 'Custom Body' && captured.url.indexOf('mytopic') >= 0,
     'ntfy: the shared sender carries the custom title/body to the topic');
}

/* ---------------- alert-check.mjs engine-outage watchdog ---------------- */

{
  const now = Date.now();
  ok(engineVerdict(null, now).ok === false, 'engine watchdog: null state -> dark');
  ok(engineVerdict({ live: false }, now).ok === false, 'engine watchdog: not live -> dark');
  ok(engineVerdict(undefined, now).why.indexOf('engineState null') >= 0,
     'engine watchdog: the dark reason names the missing publication');
  const stale = engineVerdict({ live: true, survivors: 3, at: now - ENGINE_STALE_MS - 60000 }, now);
  ok(stale.ok === false && stale.why.indexOf('stale') >= 0,
     'engine watchdog: a snapshot older than 45m reads as stale-dark — got "' + stale.why + '"');
  const live = engineVerdict({ live: true, survivors: 14, at: now - 60000 }, now);
  ok(live.ok === true && live.survivors === 14, 'engine watchdog: fresh state -> live with survivor count');
  ok(engineVerdict({ live: true, survivors: 2, at: 'garbage' }, now).ok === false,
     'engine watchdog: unparseable timestamp -> stale-dark, never trusted');

  ok(engineAlertDue(undefined, now) === true, 'engine alert: no prior stamp -> due');
  ok(engineAlertDue('garbage', now) === true, 'engine alert: corrupt stamp -> due');
  ok(engineAlertDue(new Date(now - 3600000).toISOString(), now) === false,
     'engine alert: 1h ago -> inside the 2h throttle');
  ok(engineAlertDue(new Date(now - ENGINE_ALERT_MS - 60000).toISOString(), now) === true,
     'engine alert: past the 2h throttle -> due again (continuous outage re-alerts slowly)');
}

/* ---------------- alert-check.mjs ntfy fallback selector ---------------- */

{
  const prev = { delta: null, coindcx: null, gold: null };
  const curr = { delta: 'INJUSD|long', coindcx: null, gold: null };
  const legs1 = fallbackLegs(prev, curr);
  ok(legs1.length === 1 && legs1[0].leg === 'delta' && legs1[0].key === 'INJUSD|long',
     'fallback: a NEW setup on one leg is selected for the push');
  ok(fallbackLegs(prev, { delta: null, coindcx: null, gold: null }).length === 0,
     'fallback: no setups -> nothing to push');
  const same = fallbackLegs({ delta: 'INJUSD|long' }, curr);
  ok(same.length === 0, 'fallback: unchanged alert key -> not new, no push');
  const pushed = { delta: null, ntfyFallback: { delta: { key: 'INJUSD|long', at: '2026-07-25T07:00:00Z' } } };
  ok(fallbackLegs(pushed, curr).length === 0,
     'fallback: the same setup already pushed is deduped — 15-min retries never spam');
  const moved = fallbackLegs(pushed, { delta: 'INJUSD|short', coindcx: null, gold: null });
  ok(moved.length === 1, 'fallback: a DIFFERENT setup on the same leg pushes again');
  ok(fallbackLegs(null, curr).length === 1 && fallbackLegs(undefined, undefined).length === 0,
     'fallback: garbage state -> safe defaults, never throws');
}

/* ---------------- alert-check.mjs telegram channel + cascade ---------------- */

{
  /* env hygiene: save/restore around each probe */
  const savedT = process.env.TELEGRAM_TOKEN, savedC = process.env.TELEGRAM_CHAT_ID, savedN = process.env.NTFY_TOPIC;
  delete process.env.TELEGRAM_TOKEN; delete process.env.TELEGRAM_CHAT_ID;
  const skipT = await sendTelegramCi('x');
  ok(typeof skipT === 'string' && skipT.indexOf('skipped') === 0, 'telegram: no secrets -> honest skip, no network');
  process.env.TELEGRAM_TOKEN = 'tok'; process.env.TELEGRAM_CHAT_ID = '42';
  let tgSent, tgCall = null;
  await withFetch(async (url, opts) => { tgCall = { url, opts }; return fetchOk('{}', 200)(url, opts); },
    async () => { tgSent = await sendTelegramCi('hello'); });
  ok(tgSent === 'sent' && tgCall && tgCall.url.indexOf('api.telegram.org/bot') >= 0
     && tgCall.url.indexOf('tok') >= 0 && JSON.parse(tgCall.opts.body).chat_id === '42',
     'telegram: posts sendMessage to the bot endpoint with the chat id');
  let tgFail;
  await withFetch(fetchOk('{}', 403), async () => { tgFail = await sendTelegramCi('x'); });
  ok(typeof tgFail === 'string' && tgFail.indexOf('failed') === 0, 'telegram: non-2xx -> honest failure string');
  /* cascade: telegram success short-circuits ntfy; telegram failure falls through */
  let casc1, ntfyCalls = 0;
  await withFetch(async () => { ntfyCalls++; return { status: 200, text: async () => '{}', headers: { get: () => null } }; },
    async () => { casc1 = await sendAlertCi('t', 'b'); });
  ok(casc1 === 'telegram: sent' && ntfyCalls === 1, 'cascade: telegram success is the whole result, ntfy untouched');
  delete process.env.TELEGRAM_TOKEN; delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.NTFY_TOPIC;
  let casc2;
  await withFetch(fetchOk('{}', 200), async () => { casc2 = await sendAlertCi('t', 'b'); });
  ok(typeof casc2 === 'string' && casc2.indexOf('telegram skipped') === 0 && casc2.indexOf('ntfy skipped') >= 0,
     'cascade: both channels unset -> both honestly skipped — got "' + casc2 + '"');
  if (savedT !== undefined) process.env.TELEGRAM_TOKEN = savedT;
  if (savedC !== undefined) process.env.TELEGRAM_CHAT_ID = savedC;
  if (savedN !== undefined) process.env.NTFY_TOPIC = savedN;
}

/* ---------------- config / repo files ---------------- */

{
  const v = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../vercel.json', import.meta.url)), 'utf8'));
  const keys = (v.headers && v.headers[0] && v.headers[0].headers || []).map((h) => h.key);
  ok(keys.includes('X-Content-Type-Options') && keys.includes('Referrer-Policy'), 'vercel.json keeps security headers block');
}
{
  const vi = fs.readFileSync(fileURLToPath(new URL('../.vercelignore', import.meta.url)), 'utf8');
  ok(/^alert-state\.json$/m.test(vi), '.vercelignore excludes alert-state.json (runtime state no longer publicly served)');
}
{
  const st = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../alert-state.json', import.meta.url)), 'utf8'));
  ok('delta' in st && 'coindcx' in st && 'gold' in st, 'committed alert-state.json keeps delta/coindcx/gold keys');
}
{
  const yml = fs.readFileSync(fileURLToPath(new URL('../.github/workflows/alert-notify.yml', import.meta.url)), 'utf8');
  ok(yml.includes('node scripts/alert-check.mjs'), 'workflow still runs scripts/alert-check.mjs');
  ok(yml.includes('git diff --cached --quiet || git commit'), 'workflow commit guard intact (works with heartbeat: no-op when state unchanged)');
  ok(yml.includes('TELEGRAM_TOKEN') && yml.includes('TELEGRAM_CHAT_ID'), 'workflow passes the telegram secrets');
}
for (const f of ['../api/proxy.js', '../scripts/alert-check.mjs']){
  try{
    execFileSync(process.execPath, ['--check', fileURLToPath(new URL(f, import.meta.url))], { stdio: 'pipe' });
    ok(true, 'node --check ' + f);
  }catch(e){
    ok(false, 'node --check ' + f + ' :: ' + String(e.stderr || e.message).split('\n')[0]);
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
