/* HARDGATE — tests for the /api/* rate limiter (task #11).
   Run: node tests/test-rate-limit.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  hgRateLimitCheck, hgRateLimitConfig, hgApiRateLimit,
  hgRateLimitReset, hgClientIp,
} from '../lib/rate-limit.mjs';

let passed = 0, failed = 0;
function ok(cond, label){ if (cond){ passed++; console.log('  ok - ' + label); } else { failed++; console.log('  FAIL - ' + label); } }

function fakeReq(ip, method){
  return { method: method || 'GET', headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: ip } };
}
function fakeRes(){
  const r = { headers: {}, statusCode: 0, body: '' };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = String(v); };
  r.end = (b) => { r.body = b; };
  return r;
}

console.log('== 1) config: defaults + env overrides + kill switch ==');
{
  const d = hgRateLimitConfig({});
  ok(d.windowMs === 60000 && d.readsMax === 1200 && d.writesMax === 30 && d.enabled === true,
    'defaults: 60s window, 1200 reads (hg-v1170: 300 throttled live users), 30 writes, enabled');
  const e = hgRateLimitConfig({ HG_RATE_MAX: '5', HG_RATE_MUTATING_MAX: '2', HG_RATE_WINDOW_MS: '1000' });
  ok(e.readsMax === 5 && e.writesMax === 2 && e.windowMs === 1000, 'HG_RATE_* env overrides land');
  ok(hgRateLimitConfig({ HG_RATE_LIMIT: '0' }).enabled === false, 'HG_RATE_LIMIT=0 disables the guard');
}

console.log('== 2) read budget: over the limit -> 429 + retryAfterSec ==');
{
  hgRateLimitReset();
  const env = { HG_RATE_MAX: '3', HG_RATE_MUTATING_MAX: '2' };
  let last;
  for (let i = 0; i < 4; i++) last = hgRateLimitCheck(fakeReq('9.9.9.9', 'GET'), env);
  ok(last.allowed === false && last.retryAfterSec >= 1, '4th GET with readsMax=3 is refused with retryAfterSec');
  ok(hgRateLimitCheck(fakeReq('9.9.9.8', 'GET'), env).allowed === true, 'another IP is unaffected (per-IP budget)');
}

console.log('== 3) write budget is separate from reads ==');
{
  hgRateLimitReset();
  const env = { HG_RATE_MAX: '100', HG_RATE_MUTATING_MAX: '2' };
  const a = hgRateLimitCheck(fakeReq('8.8.8.8', 'POST'), env);
  const b = hgRateLimitCheck(fakeReq('8.8.8.8', 'POST'), env);
  const c = hgRateLimitCheck(fakeReq('8.8.8.8', 'POST'), env);
  const d = hgRateLimitCheck(fakeReq('8.8.8.8', 'GET'), env);
  ok(a.allowed && b.allowed, 'first two writes pass');
  ok(c.allowed === false, 'third write over writesMax=2 is refused');
  ok(d.allowed === true, 'reads keep flowing while the write budget is spent');
}

console.log('== 4) loopback exempt — the server never rate-limits itself ==');
{
  hgRateLimitReset();
  const env = { HG_RATE_MAX: '1', HG_RATE_MUTATING_MAX: '1' };
  let all = true;
  for (let i = 0; i < 10; i++) all = all && hgRateLimitCheck(fakeReq('127.0.0.1'), env).allowed;
  ok(all, 'loopback always allowed');
  ok(hgClientIp({ headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }, socket: {} }) === '2.2.2.2',
    'x-forwarded-for takes the LAST hop — the trusted proxy append, never the client-supplied first entry');
  ok(hgClientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.7' }, socket: {} }) === '203.0.113.7',
    'a spoofed first hop is ignored — the spoofer lands in their own bucket, not the victim\'s');
}

console.log('== 5) window resets: the bucket clears after windowMs ==');
{
  hgRateLimitReset();
  const env = { HG_RATE_MAX: '1', HG_RATE_WINDOW_MS: '40' };
  ok(hgRateLimitCheck(fakeReq('7.7.7.7'), env).allowed, 'first GET passes');
  ok(hgRateLimitCheck(fakeReq('7.7.7.7'), env).allowed === false, 'second GET inside the window is refused');
  await new Promise(r => setTimeout(r, 60));
  ok(hgRateLimitCheck(fakeReq('7.7.7.7'), env).allowed, 'after the window the budget resets');
}

console.log('== 6) hgApiRateLimit writes the 429 response ==');
{
  hgRateLimitReset();
  const saved = process.env.HG_RATE_MAX;
  process.env.HG_RATE_MAX = '1'; /* the server wiring reads process.env, not a param */
  try{
    ok(hgApiRateLimit(fakeReq('6.6.6.6')) === false, 'under budget: no response written');
    const res = fakeRes();
    const blocked = hgApiRateLimit(fakeReq('6.6.6.6'), res);
    ok(blocked === true, 'over budget: guard reports blocked');
    ok(res.statusCode === 429 && res.body.includes('rate_limited'), '429 + JSON error body');
    ok(res.headers['retry-after'] === res.body.match(/"retryAfterSec":(\d+)/)[1], 'Retry-After header matches body');
  }finally{
    if (saved === undefined) delete process.env.HG_RATE_MAX; else process.env.HG_RATE_MAX = saved;
  }
}

console.log('== 7) server wiring: the guard sits on every /api/* request ==');
{
  const srv = fs.readFileSync(new URL('../scripts/server.mjs', import.meta.url), 'utf8');
  ok(/import \{ hgApiRateLimit \} from '\.\.\/lib\/rate-limit\.mjs';/.test(srv), 'server imports the limiter');
  const guardAt = srv.indexOf("u.pathname.indexOf('/api/') === 0 && hgApiRateLimit(req, res)");
  const firstRouteAt = srv.indexOf("u.pathname === '/api/proxy'");
  ok(guardAt !== -1 && firstRouteAt !== -1 && guardAt < firstRouteAt,
    'guard runs before the first /api route dispatches');
  ok(srv.indexOf('const u = new URL(') < guardAt, 'guard sits after the URL is parsed (no ReferenceError)');
}

console.log(`\nrate-limit tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
