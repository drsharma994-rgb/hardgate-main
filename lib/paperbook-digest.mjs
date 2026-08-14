/* HARDGATE — LP digest delivery (webhook + Telegram). Zero deps. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pbWeeklyDigest, pbDigestText, pbDigestHtml,
  lpDigestDue, LP_DIGEST_HOUR_UTC, LP_DIGEST_MIN_UTC, LP_DIGEST_DOW_UTC,
} from './paperbook-core.mjs';
import { digestEmailReady, sendDigestEmail } from './digest-email.mjs';
import { pbConsolidatedLp, pbConsolidatedHtml, pbConsolidatedDigestText } from './paperbook-funds.mjs';
import { telegramAlertsDisabled, telegramConfigured, sendTelegramMessage } from './telegram-guard.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DIGEST_STATE_FILE = path.join(ROOT, 'scripts', '.book-digest-state.json');

export { lpDigestDue, LP_DIGEST_HOUR_UTC, LP_DIGEST_MIN_UTC, LP_DIGEST_DOW_UTC };

export function loadDigestState(){
  try{
    var d = JSON.parse(fs.readFileSync(DIGEST_STATE_FILE, 'utf8'));
    return (d && typeof d === 'object') ? d : {};
  }catch(e){ return {}; }
}

export function saveDigestState(st){
  try{ fs.writeFileSync(DIGEST_STATE_FILE, JSON.stringify(st)); }catch(e){}
}

export function digestWebhookUrl(){
  return process.env.LP_DIGEST_WEBHOOK_URL || '';
}

export function digestTelegramReady(){
  return telegramConfigured();
}

export function digestEmailConfigured(){
  return digestEmailReady();
}

export function digestChannelsReady(){
  return !!(digestWebhookUrl() || digestTelegramReady() || digestEmailReady());
}

export function digestUseConsolidated(body){
  body = body || {};
  if (body.consolidated === true) return true;
  if (body.consolidated === false) return false;
  var env = String(process.env.LP_DIGEST_CONSOLIDATED || '').toLowerCase();
  if (env === 'true' || env === '1' || env === 'yes') return true;
  if (env === 'false' || env === '0' || env === 'no') return false;
  if (process.env.LP_DIGEST_FUND) return false;
  if (body.fund) return false;
  return true;
}

export function digestCronAuthOk(req){
  var secret = process.env.BOOK_DIGEST_CRON_SECRET || '';
  if (!secret) return true;
  try{
    var addr = req.socket && req.socket.remoteAddress;
    if (addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1') return true;
  }catch(e){}
  var hdr = req.headers && (req.headers['x-book-digest-key'] || req.headers['X-Book-Digest-Key']);
  return String(hdr || '') === secret;
}

async function sendTelegramDigest(title, text){
  if (telegramAlertsDisabled()) return { ok: false, skipped: true, reason: 'TELEGRAM_DISABLED' };
  var r = await sendTelegramMessage(String(title || 'HARDGATE LP Digest') + '\n\n' + String(text || ''));
  if (r.skipped) return { ok: false, skipped: true, reason: r.reason || 'no telegram env' };
  if (r.ok) return { ok: true };
  return { ok: false, skipped: false, reason: r.reason || 'send failed' };
}

export async function deliverLpDigest(book, period){
  period = period === 'month' ? 'month' : 'week';
  var digest = pbWeeklyDigest(book, period);
  var text = pbDigestText(digest);
  var html = pbDigestHtml(digest);
  var payload = {
    type: 'hardgate_lp_digest',
    period: digest.period,
    digest: digest,
    text: text,
    html: html,
  };
  var channels = { webhook: null, telegram: null, email: null };
  var hook = digestWebhookUrl();
  if (hook){
    try{
      var whRes = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var whText = '';
      try{ whText = await whRes.text(); }catch(e){}
      channels.webhook = { ok: whRes.ok, status: whRes.status, response: whText.slice(0, 200) };
    }catch(e){
      channels.webhook = { ok: false, reason: (e && e.message) || 'webhook error' };
    }
  }
  if (digestTelegramReady()){
    var tgTitle = 'HARDGATE WEEKLY LP DIGEST';
    if (period === 'month') tgTitle = 'HARDGATE MONTHLY LP DIGEST';
    channels.telegram = await sendTelegramDigest(tgTitle, text);
  }
  if (digestEmailReady()){
    var mailTitle = period === 'month' ? 'HARDGATE Monthly LP Digest' : 'HARDGATE Weekly LP Digest';
    channels.email = await sendDigestEmail(mailTitle, text, html);
  }
  var delivered = (channels.webhook && channels.webhook.ok)
    || (channels.telegram && channels.telegram.ok)
    || (channels.email && channels.email.ok);
  return {
    ok: delivered,
    digest: digest,
    text: text,
    html: html,
    channels: channels,
  };
}

export async function deliverConsolidatedLpDigest(store, period){
  period = period === 'month' ? 'month' : 'week';
  var monthKey = new Date().toISOString().slice(0, 7);
  var consolidated = pbConsolidatedLp(store, period, monthKey);
  var text = pbConsolidatedDigestText(consolidated);
  var html = pbConsolidatedHtml(consolidated);
  var payload = {
    type: 'hardgate_lp_digest_consolidated',
    period: consolidated.period,
    consolidated: consolidated,
    digest: consolidated,
    text: text,
    html: html,
  };
  var channels = { webhook: null, telegram: null, email: null };
  var hook = digestWebhookUrl();
  if (hook){
    try{
      var whRes = await fetch(hook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      var whText = '';
      try{ whText = await whRes.text(); }catch(e){}
      channels.webhook = { ok: whRes.ok, status: whRes.status, response: whText.slice(0, 200) };
    }catch(e){
      channels.webhook = { ok: false, reason: (e && e.message) || 'webhook error' };
    }
  }
  if (digestTelegramReady()){
    var tgTitle = period === 'month' ? 'HARDGATE CONSOLIDATED MONTHLY LP' : 'HARDGATE CONSOLIDATED WEEKLY LP';
    channels.telegram = await sendTelegramDigest(tgTitle, text);
  }
  if (digestEmailReady()){
    var mailTitle = period === 'month' ? 'HARDGATE Consolidated Monthly LP' : 'HARDGATE Consolidated Weekly LP';
    channels.email = await sendDigestEmail(mailTitle, text, html);
  }
  var delivered = (channels.webhook && channels.webhook.ok)
    || (channels.telegram && channels.telegram.ok)
    || (channels.email && channels.email.ok);
  return {
    ok: delivered,
    consolidated: consolidated,
    digest: consolidated,
    text: text,
    html: html,
    channels: channels,
  };
}
