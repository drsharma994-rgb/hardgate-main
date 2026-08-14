/* HARDGATE — lib/telegram-guard.mjs unit tests (Node 18+). */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  telegramAlertsDisabled,
  telegramConfigured,
  sendTelegramMessage,
} from '../lib/telegram-guard.mjs';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const saved = process.env.TELEGRAM_DISABLED;
const savedT = process.env.TELEGRAM_TOKEN;
const savedC = process.env.TELEGRAM_CHAT_ID;

delete process.env.TELEGRAM_DISABLED;
delete process.env.TELEGRAM_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;
ok(telegramAlertsDisabled() === false, 'disabled false when unset');
ok(telegramConfigured() === false, 'not configured without env');

process.env.TELEGRAM_DISABLED = '1';
ok(telegramAlertsDisabled() === true, 'TELEGRAM_DISABLED=1');
ok(telegramConfigured() === false, 'configured false when disabled');

process.env.TELEGRAM_TOKEN = 'tok';
process.env.TELEGRAM_CHAT_ID = '42';
ok(telegramConfigured() === false, 'still not configured when disabled');

process.env.TELEGRAM_DISABLED = '0';
ok(telegramConfigured() === true, 'configured when token+chat set');

let fetchUrl = '';
const origFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  fetchUrl = String(url);
  return { ok: true, json: async () => ({ ok: true }) };
};
const r = await sendTelegramMessage('hello');
ok(r.ok === true && fetchUrl.indexOf('api.telegram.org') >= 0, 'sendTelegramMessage posts to bot API');
globalThis.fetch = origFetch;

process.env.TELEGRAM_DISABLED = 'yes';
const r2 = await sendTelegramMessage('x');
ok(r2.skipped === true && r2.reason === 'TELEGRAM_DISABLED', 'send skips when disabled');

if (saved === undefined) delete process.env.TELEGRAM_DISABLED;
else process.env.TELEGRAM_DISABLED = saved;
if (savedT === undefined) delete process.env.TELEGRAM_TOKEN;
else process.env.TELEGRAM_TOKEN = savedT;
if (savedC === undefined) delete process.env.TELEGRAM_CHAT_ID;
else process.env.TELEGRAM_CHAT_ID = savedC;

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(/stopTelegramAlerts/.test(html), 'index STOP ALERTS control');
ok(/TELEGRAM_DISABLED/.test(fs.readFileSync(path.join(root, 'render.yaml'), 'utf8')), 'render.yaml TELEGRAM_DISABLED');
ok(/hgTelegramAlertsOff/.test(html), 'index exposes hgTelegramAlertsOff');
ok(/hgTelegramServerDisabled/.test(html), 'index reads server disable flag');

console.log('\n' + n + ' passed');
process.exit(0);
