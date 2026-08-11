/* HARDGATE — api-auth.mjs + notify-api wiring (fix pack 12). */
import { checkApiAuth, apiSecret, apiAuthHeaders } from '../lib/api-auth.mjs';
import { executeCapabilities } from '../lib/execute-api.mjs';
import { notifyCapabilities, telegramTokenHealth } from '../lib/notify-api.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== checkApiAuth fail-closed ==');
{
  const prev = process.env.HARDGATE_API_SECRET;
  delete process.env.HARDGATE_API_SECRET;
  ok(!checkApiAuth({ headers: {} }).ok, 'no secret -> 503');
  ok(checkApiAuth({ headers: {} }).status === 503, 'status 503 when unset');
  process.env.HARDGATE_API_SECRET = 'test-secret-abc';
  ok(!checkApiAuth({ headers: {} }).ok, 'wrong key -> fail');
  ok(checkApiAuth({ headers: { 'x-hardgate-key': 'test-secret-abc' } }).ok, 'x-hardgate-key match');
  ok(checkApiAuth({ headers: { authorization: 'Bearer test-secret-abc' } }).ok, 'Bearer match');
  if (prev) process.env.HARDGATE_API_SECRET = prev; else delete process.env.HARDGATE_API_SECRET;
}

console.log('== execute capabilities auth flags ==');
{
  ok(executeCapabilities().authRequired === true, 'authRequired true');
  ok(typeof executeCapabilities().authConfigured === 'boolean', 'authConfigured boolean');
}

console.log('== wiring ==');
{
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  ok(idx.indexOf('api.telegram.org/bot') < 0, 'index.html no direct Telegram bot URL');
  ok(idx.indexOf('/api/notify') >= 0, 'index.html uses /api/notify');
  ok(fs.existsSync(path.join(root, 'lib/api-auth.mjs')), 'lib/api-auth.mjs exists');
  ok(fs.existsSync(path.join(root, 'lib/notify-api.mjs')), 'lib/notify-api.mjs exists');
  ok(fs.existsSync(path.join(root, 'api-client.js')), 'api-client.js exists');
  const book = fs.readFileSync(path.join(root, 'book.js'), 'utf8');
  ok(book.indexOf('hgApiHeaders') >= 0, 'book.js uses hgApiHeaders');
  const loop = fs.readFileSync(path.join(root, 'lib/daemon-loop.mjs'), 'utf8');
  ok(loop.indexOf('freshLocks') >= 0 && loop.indexOf('excludeIds') >= 0, 'daemon-loop freshLocks + excludeIds');
  ok(typeof notifyCapabilities().telegram === 'boolean', 'notify capabilities');
  ok(notifyCapabilities().authRequired === false, 'notify does not require HARDGATE_API_SECRET');
  ok(apiAuthHeaders()['Content-Type'] === 'application/json', 'apiAuthHeaders content-type');
  ok(idx.indexOf('/api/notify/capabilities') >= 0, 'index.html checks notify capabilities');
  const notifySrc = fs.readFileSync(path.join(root, 'lib/notify-api.mjs'), 'utf8');
  ok(notifySrc.indexOf('telegramTokenHealth') >= 0, 'notify-api token health check');
  ok(notifySrc.indexOf('checkApiAuth(req)') < 0, 'notify POST does not gate on api secret');
}

console.log('== telegram token health (no env) ==');
{
  const prevT = process.env.TELEGRAM_TOKEN;
  const prevC = process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  ok((await telegramTokenHealth()).configured === false, 'health unconfigured when env missing');
  if (prevT) process.env.TELEGRAM_TOKEN = prevT; else delete process.env.TELEGRAM_TOKEN;
  if (prevC) process.env.TELEGRAM_CHAT_ID = prevC; else delete process.env.TELEGRAM_CHAT_ID;
}

console.log('\n' + pass + ' passed');
