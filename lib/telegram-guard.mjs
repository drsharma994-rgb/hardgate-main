/* HARDGATE — central Telegram alert guard (browser + Node).
   Set TELEGRAM_DISABLED=1 on Render / GitHub Actions to stop all server-side sends.
   Browser uses localStorage hgTelegramOff via index.html sendTelegram().

   hg-v1112: the chat receives a Trend Matrix golden bull, including a
   composite +5/5 !GOLDEN card, and a Gold Scalp row. Death crosses and
   crypto that is not a golden bull are not delivered. */

export function telegramAlertsDisabled(){
  var v = String(process.env.TELEGRAM_DISABLED || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function telegramEnv(){
  return {
    token: process.env.TELEGRAM_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  };
}

export function telegramConfigured(){
  if (telegramAlertsDisabled()) return false;
  var e = telegramEnv();
  return !!(e.token && e.chatId);
}

function isGoldenBull(text){
  var u = String(text || '').toUpperCase();
  if (!u) return false;
  if (u.indexOf('DEATH CROSS') >= 0 && u.indexOf('GOLDEN') < 0) return false;
  if (u.indexOf('DEATH CROSS') >= 0 && u.indexOf('GOLDEN CROSS') < 0 && u.indexOf('!GOLDEN') < 0) return false;
  var golden = u.indexOf('GOLDEN') >= 0 || u.indexOf('!GOLDEN') >= 0;
  if (!golden) return false;
  if (u.indexOf('TREND MATRIX GOLDEN CROSS') >= 0) return true;
  if (u.indexOf('COMPOSITE') >= 0 && (u.indexOf('+5/5') >= 0 || u.indexOf('+5 / 5') >= 0)) return true;
  if (u.indexOf('!GOLDEN') >= 0 && (u.indexOf('+5/5') >= 0 || u.indexOf('COMPOSITE') >= 0)) return true;
  if (u.indexOf('SETUP COMPOSITE') >= 0 && u.indexOf('GOLDEN') >= 0) return true;
  return false;
}

/* Keep a golden-bull alert whole, including composite +5/5 !GOLDEN.
   From a mixed batch, keep only Gold Scalp rows. Return '' otherwise. */
export function telegramKeepText(text){
  var t = String(text || '');
  if (isGoldenBull(t)) return t;
  if (t.indexOf('Tab/source: GOLD SCALP') < 0) return '';
  var parts = t.split('\n\n');
  var kept = [];
  var i;
  for (i = 0; i < parts.length; i++){
    if (parts[i].indexOf('Tab/source: GOLD SCALP') >= 0
        && parts[i].indexOf('Tab/source: GOLD SWING') < 0){
      kept.push(parts[i]);
    }
  }
  if (!kept.length) return '';
  return 'HARDGATE — GOLD SCALP\n' + kept.join('\n\n');
}

/** Send a Telegram message. Never throws. */
export async function sendTelegramMessage(text, opts){
  opts = opts || {};
  if (telegramAlertsDisabled()){
    return { ok: false, skipped: true, reason: 'TELEGRAM_DISABLED' };
  }
  var kept = telegramKeepText(text);
  if (!kept){
    return { ok: true, filtered: true };
  }
  var token = opts.token || process.env.TELEGRAM_TOKEN || '';
  var chat = opts.chatId != null ? opts.chatId : (process.env.TELEGRAM_CHAT_ID || '');
  if (!token || !chat){
    return { ok: false, skipped: true, reason: 'no TELEGRAM_TOKEN/TELEGRAM_CHAT_ID' };
  }
  try{
    var res = await fetch('https://api.telegram.org/bot' + encodeURIComponent(token) + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: String(kept).slice(0, 4096),
        disable_web_page_preview: true,
      }),
    });
    var j = null;
    try{ j = await res.json(); }catch(e0){}
    var httpOk = res.ok === true || (res.status >= 200 && res.status < 300);
    if (!httpOk){
      var desc = (j && j.description) ? String(j.description) : ('HTTP ' + res.status);
      return { ok: false, skipped: false, reason: desc.slice(0, 240) };
    }
    if (j && j.ok === false){
      var desc2 = j.description ? String(j.description) : 'api returned ok:false';
      return { ok: false, skipped: false, reason: desc2.slice(0, 240) };
    }
    return { ok: true };
  }catch(e1){
    return { ok: false, skipped: false, reason: (e1 && e1.message) || String(e1) };
  }
}
