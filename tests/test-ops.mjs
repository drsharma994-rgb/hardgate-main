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
         fallbackLegs, sniperKey, sniperBody, squeezeKey, squeezeBody,
         mergeSetups, setupKey, freshSetups, setupsBody, SETUP_REMIND_MS,
         digestDue, digestBody, ticketLine, DIGEST_HOUR_UTC, DIGEST_MIN_UTC,
         bookExecSnapshot, bookExecKey, bookExecAlertDue, bookExecBody, BOOK_EXEC_ALERT_MS,
         istOffHours, offHoursPrefix, offHoursTag } from '../scripts/alert-check.mjs';
import { fireKey, newFires, atrPlan, fmtL, watchBody, INTERVAL_MS as SQ_WATCH_MS } from '../scripts/squeeze-watch.mjs';

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

/* ---------------- alert-check.mjs book bracket backlog helpers ---------------- */

{
  const now = Date.now();
  const desk = { execute: { ok: 2, fail: 1, pending: 3 }, funds: [{ id: 'main', openCount: 2 }, { id: 'gold', openCount: 1 }] };
  const snap = bookExecSnapshot(desk);
  ok(snap.pending === 3 && snap.fail === 1 && snap.ok === 2, 'book exec snapshot reads desk execute rollup');
  ok(bookExecKey(snap) === 'p3|f1', 'book exec key encodes pending/fail counts');
  ok(bookExecSnapshot(null).pending === 0, 'book exec snapshot: missing desk -> zeros');
  ok(bookExecAlertDue(undefined, now) === true, 'book exec alert: no prior stamp -> due');
  ok(bookExecAlertDue(new Date(now - 3600000).toISOString(), now) === false,
     'book exec alert: 1h ago -> inside 4h throttle');
  ok(bookExecAlertDue(new Date(now - BOOK_EXEC_ALERT_MS - 60000).toISOString(), now) === true,
     'book exec alert: past 4h throttle -> due again');
  const body = bookExecBody(desk, snap);
  ok(body.indexOf('3 open without bracket') >= 0 && body.indexOf('main (2 open)') >= 0
     && body.indexOf('ALL FUNDS PENDING') >= 0,
     'book exec body names backlog + funds + remediation');
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
  let defCall = null, defSent;
  await withFetch(async (url, opts) => { defCall = { url, opts }; return fetchOk('{}', 200)(url, opts); },
    async () => { defSent = await sendTelegramCi('x'); });
  ok(defSent === 'sent' && defCall && defCall.url.indexOf('api.telegram.org/bot') >= 0
     && JSON.parse(defCall.opts.body).chat_id === '1004014764',
     'telegram: no env secrets -> baked-in owner defaults used (not skipped)');
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
  ok(casc2 === 'telegram: sent',
     'cascade: env unset -> baked-in telegram defaults still deliver — got "' + casc2 + '"');
  if (savedT !== undefined) process.env.TELEGRAM_TOKEN = savedT;
  if (savedC !== undefined) process.env.TELEGRAM_CHAT_ID = savedC;
  if (savedN !== undefined) process.env.NTFY_TOPIC = savedN;
}

/* ---------------- alert-check.mjs sniper-grade helpers ---------------- */

{
  ok(sniperKey(null) === '' && sniperKey([null, {}, { sym: 'X' }]) === '',
     'sniper key: garbage/entry-less hits -> empty key, never throws');
  ok(sniperKey([{ sym: 'B', entry: 2 }, { sym: 'A', entry: 1 }]) === 'A@1;B@2',
     'sniper key: sym@entry, sorted deterministically');
  ok(sniperKey([{ sym: 'A', entry: 1 }]) !== sniperKey([{ sym: 'A', entry: 1.01 }]),
     'sniper key: a moved entry changes the key (re-alerts)');
  const body = sniperBody([
    { sym: 'ACE', dir: 'short', entry: 0.085, stop: 0.089, t1: 0.077, lev: 24, state: 'IN ZONE' },
    { sym: 'B', dir: 'long', entry: 10, stop: 9.7, t1: 10.6, lev: 20, state: 'APPROACHING' }
  ]);
  ok(body.indexOf('ACE SHORT @ 0.085 (24x, IN ZONE) · stop 0.089 · T1 0.077') >= 0,
     'sniper body: levels + leverage + state spelled out — got "' + body.split('\n')[0] + '"');
  ok(sniperBody(Array.from({ length: 7 }, function(_, i){ return { sym: 'S' + i, dir: 'long', entry: i + 1, stop: i, t1: i + 2, lev: 25, state: 'IN ZONE' }; }))
       .indexOf('+2 more') >= 0,
     'sniper body: long hit lists truncate with a +N more tail');
  ok(sniperBody([{ sym: 'ACE', dir: 'short', entry: 0.085, stop: 0.089, t1: 0.077, lev: 24, state: 'IN ZONE' }])
       .indexOf('valid until ~') >= 0
       && sniperBody([{ sym: 'ACE', dir: 'short', entry: 0.085, stop: 0.089, t1: 0.077, lev: 24, state: 'IN ZONE' }])
       .indexOf('24h limit validity') >= 0,
     'sniper body: the 24h validity window is named so the owner knows the fill window');
}

/* ---------------- alert-check.mjs daily digest helpers ---------------- */

{
  const at = (h, m) => Date.UTC(2026, 6, 27, h, m);
  ok(digestDue(undefined, at(DIGEST_HOUR_UTC, DIGEST_MIN_UTC + 5)) === true,
     'digest: first ever run inside the window -> due');
  ok(digestDue('garbage', at(DIGEST_HOUR_UTC, DIGEST_MIN_UTC + 5)) === true,
     'digest: corrupt stamp inside the window -> due');
  ok(digestDue(undefined, at(DIGEST_HOUR_UTC, DIGEST_MIN_UTC - 5)) === false,
     'digest: before the window -> not due');
  ok(digestDue(undefined, at(DIGEST_HOUR_UTC + 2, 0)) === false,
     'digest: after the window -> not due');
  ok(digestDue(new Date(at(DIGEST_HOUR_UTC, DIGEST_MIN_UTC + 1) - 21 * 3600000).toISOString(), at(DIGEST_HOUR_UTC, DIGEST_MIN_UTC + 5)) === true,
     'digest: 21h-old stamp -> due again (next day)');
  ok(digestDue(new Date(at(DIGEST_HOUR_UTC, DIGEST_MIN_UTC + 1)).toISOString(), at(DIGEST_HOUR_UTC, DIGEST_MIN_UTC + 5)) === false,
     'digest: 4-min-old stamp -> suppressed (one per day)');

  const body = digestBody({
    now: Date.UTC(2026, 6, 27, DIGEST_HOUR_UTC, DIGEST_MIN_UTC + 1),
    read: 'MIXED — SELECTIVE regime (score -2) · on-chain neutral · F&G 26 Fear',
    ticket: { long: null, short: { sym: 'ACE', entry: 0.085 } },
    prevTicket: { long: { sym: 'DOGE', entry: 0.069 }, short: null },
    sniper: [{ sym: 'ACE', dir: 'short', entry: 0.085, lev: 24 }],
    engineOk: true, survivors: 7,
    top: [{ sym: 'WLD', dir: 'short', tier: 'WATCH', entry: 0.3437, stop: 0.367, t1: 0.305 }]
  });
  ok(body.indexOf('Market: MIXED — SELECTIVE') >= 0, 'digest: market read line carried');
  ok(body.indexOf('Ticket: LONG — · SHORT ACE @ 0.085') >= 0, 'digest: ticket levels spelled, empty side as —');
  ok(body.indexOf('Sniper-grade: ACE SHORT @ 0.085 (24x)') >= 0, 'digest: sniper hits with leverage');
  ok(body.indexOf('Engine: 7 survivors voting') >= 0, 'digest: engine line');
  ok(body.indexOf('· WLD SHORT (WATCH) @ 0.3437 · stop 0.367 · T1 0.305') >= 0, 'digest: top planned rows with levels');
  ok(body.indexOf('Last digest ticket: LONG DOGE @ 0.069 · SHORT —') >= 0, 'digest: yesterday comparison carried');
  ok(body.indexOf('IST') >= 0, 'digest: IST timestamp present');
  const empty = digestBody({ now: Date.now(), read: '', ticket: { long: null, short: null },
    sniper: [], engineOk: false, top: [] });
  ok(empty.indexOf('Engine: DARK') >= 0 && empty.indexOf('Top plans: none') >= 0,
     'digest: dark engine + empty board render honestly, never hidden');
  ok(ticketLine({ long: null, short: null }) === 'LONG — · SHORT —', 'digest: ticket line null-safe');

  /* hosting-health line: up / degraded / absent */
  const up = digestBody({ now: Date.now(), read: '', ticket: { long: null, short: null },
    sniper: [], engineOk: true, survivors: 3, top: [], hosting: { ok: true, status: 200, ms: 1234 } });
  ok(up.indexOf('Hosting: Render UP · http 200 · 1.2s') >= 0, 'digest: hosting line — Render up with latency');
  const down = digestBody({ now: Date.now(), read: '', ticket: { long: null, short: null },
    sniper: [], engineOk: false, top: [], hosting: { ok: false, status: 503, ms: 900 } });
  ok(down.indexOf('Hosting: DEGRADED — http 503') >= 0 && down.indexOf('Render dashboard') >= 0,
     'digest: hosting line — degraded names the status + where to look');
  const tout = digestBody({ now: Date.now(), read: '', ticket: { long: null, short: null },
    sniper: [], engineOk: false, top: [], hosting: { ok: false, status: 0, ms: 0, err: 'timeout >20s' } });
  ok(tout.indexOf('Hosting: DEGRADED — timeout >20s') >= 0, 'digest: hosting line — timeout names the error, not a fake status');
  ok(body.indexOf('Hosting:') === -1, 'digest: no probe -> no hosting line (older callers stay clean)');
}

/* ---------------- squeeze key/body (server pipeline) ---------------- */
{
  const rows = [
    { sym: 'SOLUSDT', dir: 'long',  kind: 'fired' },
    { sym: 'ACEUSDT', dir: 'short', kind: 'break' },
    { sym: 'DOGEUSDT', dir: null,   kind: 'build' },     /* building: never keys, never bodies */
    { sym: 'XRPUSDT', dir: 'long',  kind: 'fired' }
  ];
  ok(squeezeKey(rows) === 'ACEUSDT:short;SOLUSDT:long;XRPUSDT:long',
     'squeezeKey: sym:dir sorted, fired+break only, build rows excluded');
  ok(squeezeKey([]) === '' && squeezeKey(null) === '', 'squeezeKey: empty/garbage -> empty key, never throws');
  const sb = squeezeBody(rows.filter(r => r.kind !== 'build'));
  ok(sb.indexOf('SOLUSDT LONG (FIRED)') >= 0 && sb.indexOf('ACEUSDT SHORT (DONCHIAN BREAK)') >= 0,
     'squeezeBody: kind spelled honestly (FIRED vs DONCHIAN BREAK)');
  ok(sb.indexOf('levels on the SQUEEZE tab') >= 0, 'squeezeBody: no levels server-side -> points at the tab');
  const many = [];
  for (let i = 0; i < 8; i++) many.push({ sym: 'S' + i, dir: 'long', kind: 'fired' });
  ok(squeezeBody(many).indexOf('+3 more') >= 0, 'squeezeBody: >5 rows summarized honestly');
}

/* ---------------- confirmed setups sweep (server pipeline) ---------------- */
{
  const raw = [
    { src: 'BRAIN PRIME', sym: 'BTCUSDT', dir: 'long',  entry: 100, stop: 97, t1: 106, t2: 110.5 },
    { src: 'EXECUTE STRONG', sym: 'BTCUSDT', dir: 'long', entry: 100, stop: 97, t1: 106 },
    { src: 'BRAIN HIGH', sym: 'SOLUSDT', dir: 'short', entry: 50, stop: 52, t1: 46 },
    { src: 'BRAIN HIGH', sym: 'BAD1', dir: 'long', entry: null, stop: 1, t1: 2 },      /* no entry -> dropped */
    { src: 'BRAIN HIGH', sym: 'BAD2', dir: 'long', entry: 10, stop: 10, t1: 12 },       /* zero risk -> dropped */
    { src: 'EXECUTE WEAK', sym: 'BAD3', dir: 'long', entry: 10, stop: 9, t1: null }     /* no TP -> dropped */
  ];
  const m = mergeSetups(raw);
  ok(m.length === 2, 'mergeSetups: invalid rows dropped (null entry/stop/t1, zero risk)');
  ok(m[0].sym === 'BTCUSDT' && m[0].src === 'BRAIN PRIME + EXECUTE STRONG' && m[0].t2 === 110.5,
     'mergeSetups: same sym+dir merges, sources join, t2 survives');
  ok(setupsBody(m).indexOf('· BTCUSDT LONG [BRAIN PRIME + EXECUTE STRONG] @ 100 · SL 97 · TP 106 · T2 110.5') >= 0,
     'setupsBody: entry/SL/TP/T2 spelled with both source badges');
  const now = Date.UTC(2026, 6, 29, 12, 0);
  const f1 = freshSetups({}, m, now);
  ok(f1.fresh.length === 2 && Object.keys(f1.keys).length === 2, 'freshSetups: empty memory -> all fresh');
  const f2 = freshSetups(f1.keys, m, now + 900000);
  ok(f2.fresh.length === 0, 'freshSetups: unchanged board 15 min later -> no re-push');
  const f3 = freshSetups(f2.keys, m.concat([{ src: 'BRAIN PRIME', sym: 'ACEUSDT', dir: 'long', entry: 0.085, stop: 0.08, t1: 0.095 }]), now + 1800000);
  ok(f3.fresh.length === 1 && f3.fresh[0].sym === 'ACEUSDT', 'freshSetups: only the NEW formation pushes');
  const f4 = freshSetups(f1.keys, m, now + SETUP_REMIND_MS + 1000);
  ok(f4.fresh.length === 2, 'freshSetups: after 24h a still-live setup reminds honestly');
  ok(freshSetups(null, null, now).fresh.length === 0, 'freshSetups: garbage -> nothing, never throws');
  const many = [];
  for (let i = 0; i < 10; i++) many.push({ src: 'BRAIN HIGH', sym: 'S' + i, dir: 'long', entry: 10 + i, stop: 9, t1: 12 + i });
  ok(setupsBody(many).indexOf('+2 more') >= 0, 'setupsBody: >8 setups summarized honestly');
}

/* ---------------- squeeze-watch (Render 5-min scanner) ---------------- */
{
  ok(SQ_WATCH_MS === 5 * 60 * 1000, 'squeeze-watch: true 5-minute cadence');
  const fires = [
    { sym: 'BNBUSDT', dir: 'short', firedAgo: 0, fireBarT: 1785297600000,
      plan: { entry: 568.87, stop: 576.511162, t1: 553.587675, t2: 542.125931 } },
    { sym: 'SPCXUSDT', dir: 'long', firedAgo: 2, fireBarT: 1785268800000, plan: null }
  ];
  ok(fireKey(fires[0]) === 'BNBUSDT:short:1785297600000', 'fireKey: sym:dir:fireBar — the fire-bar identity');
  const now = Date.UTC(2026, 6, 29, 12, 0);
  const n1 = newFires({}, fires, now);
  ok(n1.fresh.length === 2, 'newFires: empty memory -> all fresh');
  const n2 = newFires(n1.keys, fires, now + 5 * 60000);
  ok(n2.fresh.length === 0, 'newFires: same fire bars 5 min later -> NO repeat push (the 5-min dedupe)');
  const n3 = newFires(n2.keys, fires.concat([{ sym: 'SOLUSDT', dir: 'long', firedAgo: 0, fireBarT: 1785300000000, plan: null }]), now + 10 * 60000);
  ok(n3.fresh.length === 1 && n3.fresh[0].sym === 'SOLUSDT', 'newFires: only the new fire pushes');
  const n4 = newFires(n1.keys, fires, now + 49 * 3600000);
  ok(n4.fresh.length === 2, 'newFires: 48h-old memory expires -> a persistent fire re-alerts honestly');
  /* atrPlan: long + short geometry, garbage safety */
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push({ t: i, o: 100, h: 102, l: 98, c: 100, v: 1000 });
  const atrFn = (r, n) => r.map(() => 2);   /* ATR = 2 */
  const pl = atrPlan(atrFn, rows, 'long');
  ok(pl && pl.entry === 100 && pl.stop === 97 && pl.t1 === 106 && pl.t2 === 110.5,
     'atrPlan LONG: stop 1.5xATR below, T1 2R, T2 3.5R');
  const ps = atrPlan(atrFn, rows, 'short');
  ok(ps && ps.stop === 103 && ps.t1 === 94 && ps.t2 === 89.5, 'atrPlan SHORT: mirrored geometry');
  ok(atrPlan(null, rows, 'long') === null && atrPlan(atrFn, [], 'long') === null
     && atrPlan(atrFn, rows, 'flat') === null, 'atrPlan: missing fn/rows or bad dir -> null, never throws');
  ok(fmtL(553.5876748294394) === '553.588' && fmtL(0.000012345678) === '0.0000123457' && fmtL(null) === '—',
     'fmtL: 6 significant digits, garbage as —');
  const body = watchBody(fires);
  ok(body.indexOf('BNBUSDT SHORT — TTM squeeze FIRED (4h, 0 bars ago)') >= 0
     && body.indexOf('entry 568.87 · SL 576.511 · TP 553.588') >= 0,
     'watchBody: fired line + formatted levels');
  ok(body.indexOf('SPCXUSDT LONG — TTM squeeze FIRED (4h, 2 bars ago)') >= 0
     && body.indexOf('levels on the SQUEEZE tab') >= 0,
     'watchBody: plan-less fire honestly points at the tab');
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
{
  const bd = fs.readFileSync(fileURLToPath(new URL('../.github/workflows/book-digest.yml', import.meta.url)), 'utf8');
  ok(bd.includes('/api/book/digest/send'), 'book-digest workflow hits digest send endpoint');
  ok(bd.includes('"cron":true'), 'book-digest workflow passes cron flag');
}
/* off-hours session tag — same IST windows as brain.js sessionWindow;
   deterministic UTC anchors (IST = UTC + 5:30) */
{
  ok(istOffHours(Date.UTC(2026, 6, 28, 20, 0)) === true, 'istOffHours: 01:30 IST Tuesday -> off-hours');
  ok(istOffHours(Date.UTC(2026, 6, 26, 4, 0)) === true, 'istOffHours: Sunday 09:30 IST -> off-hours');
  ok(istOffHours(Date.UTC(2026, 6, 27, 4, 30)) === false, 'istOffHours: 10:00 IST Monday -> live');
  ok(istOffHours(Date.UTC(2026, 6, 27, 7, 30)) === false, 'istOffHours: 13:00 IST London KZ -> live (KZ is not dead)');
  ok(istOffHours('garbage') === false, 'istOffHours: garbage -> live, never throws');
  ok(offHoursPrefix(Date.UTC(2026, 6, 28, 20, 0)).indexOf('OFF-HOURS') >= 0
     && offHoursPrefix(Date.UTC(2026, 6, 27, 4, 30)) === '', 'offHoursPrefix: title prefix only off-hours');
  ok(offHoursTag(Date.UTC(2026, 6, 28, 20, 0)).indexOf('half size or skip') > 0
     && offHoursTag(Date.UTC(2026, 6, 27, 4, 30)) === '', 'offHoursTag: body warning only off-hours');
}
{
  const alertSrc = fs.readFileSync(fileURLToPath(new URL('../scripts/alert-check.mjs', import.meta.url)), 'utf8');
  ok(alertSrc.indexOf('bookTryPollFills') >= 0 && alertSrc.indexOf('caps.fillPoll') >= 0,
    'alert-check auto poll-fills when fillPoll configured');
}
for (const f of ['../api/proxy.js', '../api/fred.js', '../scripts/alert-check.mjs', '../scripts/server.mjs', '../lib/digest-email.mjs', '../lib/execute-api.mjs']){
  try{
    execFileSync(process.execPath, ['--check', fileURLToPath(new URL(f, import.meta.url))], { stdio: 'pipe' });
    ok(true, 'node --check ' + f);
  }catch(e){
    ok(false, 'node --check ' + f + ' :: ' + String(e.stderr || e.message).split('\n')[0]);
  }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
