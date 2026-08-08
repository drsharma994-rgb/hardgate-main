/* HARDGATE — server-side Telegram notify (token never sent to browser). */
import { checkApiAuth } from './api-auth.mjs';

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

export function notifyCapabilities(){
  return {
    ok: true,
    telegram: !!(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID),
  };
}

export function createNotifyApi(){
  return async function notifyHandler(req, res){
    try{
      var u = new URL(req.url || '/', 'http://localhost');
      var method = (req.method || 'GET').toUpperCase();

      if (method === 'GET' && u.pathname === '/api/notify/capabilities'){
        return sendJson(res, 200, notifyCapabilities());
      }

      if (method === 'POST' && u.pathname === '/api/notify'){
        var auth = checkApiAuth(req);
        if (!auth.ok) return sendJson(res, auth.status, { ok: false, reason: auth.reason });

        var token = process.env.TELEGRAM_TOKEN || '';
        var chatId = process.env.TELEGRAM_CHAT_ID || '';
        if (!token || !chatId){
          return sendJson(res, 503, { ok: false, reason: 'Set TELEGRAM_TOKEN and TELEGRAM_CHAT_ID on the server' });
        }

        var body = await readBody(req);
        var text = String((body && body.text) || '').slice(0, 2000);
        if (!text.trim()){
          return sendJson(res, 400, { ok: false, reason: 'text required' });
        }

        var chat = (body && body.chat_id != null) ? body.chat_id : chatId;
        var tgRes = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chat, text: text, disable_web_page_preview: true }),
        });
        var j = null;
        try{ j = await tgRes.json(); }catch(e){}
        if (!tgRes.ok || !(j && j.ok)){
          var desc = (j && j.description) ? String(j.description) : ('HTTP ' + tgRes.status);
          return sendJson(res, 502, { ok: false, reason: desc.slice(0, 200) });
        }
        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 404, { ok: false, reason: 'not found' });
    }catch(e){
      return sendJson(res, 500, { ok: false, reason: (e && e.message) || 'server error' });
    }
  };
}
