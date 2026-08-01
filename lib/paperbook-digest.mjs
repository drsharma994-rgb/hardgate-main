/* HARDGATE — LP digest delivery (webhook + Telegram). Zero deps. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pbWeeklyDigest, pbDigestText, pbDigestHtml,
  lpDigestDue, LP_DIGEST_HOUR_UTC, LP_DIGEST_MIN_UTC, LP_DIGEST_DOW_UTC,
} from './paperbook-core.mjs';
import { digestEmailReady, sendDigestEmail } from './digest-email.mjs';

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
  return !!(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export function digestEmailConfigured(){
  return digestEmailReady();
}

export function digestChannelsReady(){
  return !!(digestWebhookUrl() || digestTelegramReady() || digestEmailReady());
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
  var token = process.env.TELEGRAM_TOKEN || '';
  var chat = process.env.TELEGRAM_CHAT_ID || '';
  if (!token || !chat) return { ok: false, skipped: true, reason: 'no telegram env' };
  try{
    var res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: String(title || 'HARDGATE LP Digest') + '\n\n' + String(text || ''),
        disable_web_page_preview: true,
      }),
    });
    return { ok: res.ok, status: res.status };
  }catch(e){
    return { ok: false, reason: (e && e.message) || 'telegram error' };
  }
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
