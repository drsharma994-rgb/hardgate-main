/* HARDGATE — server-side Telegram notify (token never sent to browser). */
import { checkApiAuth } from './api-auth.mjs';
import {
  telegramAlertsDisabled,
  telegramConfigured,
  telegramEnv,
  sendTelegramMessage,
} from './telegram-guard.mjs';

function sendJson(res, status, obj){
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

async function readBody(req){
  return new Promise(function(resolve){
    var chunks = [];
    req.on('data', function(c){ chunks.push(c); });
    req.on('end', function(){
      try{
        var raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      }catch(e){ resolve(null); }
    });
    req.on('error', function(){ resolve(null); });
  });
}

function telegramEnvLocal(){
  return telegramEnv();
}

/** Ping Telegram getMe — validates bot token without sending a message. */
export async function telegramTokenHealth(){
  var env = telegramEnvLocal();
  if (telegramAlertsDisabled()){
    return { configured: false, ok: false, reason: 'Telegram alerts disabled (TELEGRAM_DISABLED)' };
  }
  if (!env.token || !env.chatId){
    return { configured: false, ok: false, reason: 'Set TELEGRAM_TOKEN and TELEGRAM_CHAT_ID on the server' };
  }
  try{
    var res = await fetch('https://api.telegram.org/bot' + encodeURIComponent(env.token) + '/getMe');
    var j = null;
    try{ j = await res.json(); }catch(e){}
    if (!res.ok || !(j && j.ok)){
      var desc = (j && j.description) ? String(j.description) : ('HTTP ' + res.status);
      return {
        configured: true,
        ok: false,
        reason: desc.slice(0, 240),
        hint: res.status === 401 ? 'Token invalid or revoked — create a new bot token via @BotFather and update Render + GitHub secrets' : null,
      };
    }
    return {
      configured: true,
      ok: true,
      bot: (j.result && j.result.username) ? '@' + j.result.username : null,
    };
  }catch(e){
    return { configured: true, ok: false, reason: (e && e.message) || String(e) };
  }
}

export function notifyCapabilities(){
  var base = {
    ok: true,
    telegram: telegramConfigured(),
    telegramDisabled: telegramAlertsDisabled(),
    authRequired: false,
  };
  return base;
}

export async function notifyCapabilitiesFull(){
  var base = notifyCapabilities();
  var health = await telegramTokenHealth();
  return Object.assign({}, base, {
    tokenOk: health.ok,
    tokenError: health.ok ? null : (health.reason || null),
    tokenHint: health.hint || null,
    bot: health.bot || null,
  });
}

export function createNotifyApi(){
  return async function notifyHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      var method = (req.method || 'GET').toUpperCase();

      if (method === 'GET' && u.pathname === '/api/notify/capabilities'){
        return sendJson(res, 200, await notifyCapabilitiesFull());
      }

      if (method === 'POST' && u.pathname === '/api/notify'){
        /* Notify is not a trading mutation — token stays server-side; no HARDGATE_API_SECRET required. */
        if (telegramAlertsDisabled()){
          return sendJson(res, 503, { ok: false, reason: 'Telegram alerts disabled — set TELEGRAM_DISABLED=0 to re-enable' });
        }
        var env = telegramEnvLocal();
        if (!env.token || !env.chatId){
          return sendJson(res, 503, { ok: false, reason: 'Set TELEGRAM_TOKEN and TELEGRAM_CHAT_ID on the server' });
        }

        var body = await readBody(req);
        var text = String((body && body.text) || '').slice(0, 2000);
        if (!text.trim()){
          return sendJson(res, 400, { ok: false, reason: 'text required' });
        }

        var chat = (body && body.chat_id != null) ? body.chat_id : env.chatId;
        var tgRes = await sendTelegramMessage(text, { token: env.token, chatId: chat });
        if (tgRes.skipped){
          return sendJson(res, 503, { ok: false, reason: tgRes.reason || 'Telegram skipped' });
        }
        if (!tgRes.ok){
          var desc = tgRes.reason || 'send failed';
          var hint = desc.indexOf('401') >= 0 || /unauthorized/i.test(desc)
            ? 'Telegram token invalid/revoked — get a new token from @BotFather, update Render hardgate-main + GitHub repo secrets TELEGRAM_TOKEN'
            : (desc.indexOf('chat not found') >= 0
              ? 'Wrong TELEGRAM_CHAT_ID — for groups add the bot and send a message first, then use getUpdates for the chat id'
              : null);
          return sendJson(res, 502, { ok: false, reason: desc.slice(0, 200), hint: hint });
        }
        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}

/* Re-export for routes that still gate other mutations. */
export { checkApiAuth };
