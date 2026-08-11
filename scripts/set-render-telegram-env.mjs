#!/usr/bin/env node
/* HARDGATE — set TELEGRAM_TOKEN on Render hardgate-main (persists across deploys).
   Usage:
     RENDER_API_KEY=rnd_... TELEGRAM_TOKEN=... node scripts/set-render-telegram-env.mjs
   Optional:
     TELEGRAM_CHAT_ID=...       (set if missing or rotating chat)
     RENDER_SERVICE_ID=srv-...
     RENDER_SERVICE_NAME=hardgate-main
     TRIGGER_DEPLOY=1           (default: trigger deploy after update)
*/
import { spawnSync } from 'node:child_process';

const API = 'https://api.render.com/v1';
const apiKey = process.env.RENDER_API_KEY;
const telegramToken = process.env.TELEGRAM_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;
const serviceId = process.env.RENDER_SERVICE_ID;
const serviceName = process.env.RENDER_SERVICE_NAME || 'hardgate-main';
const triggerDeploy = process.env.TRIGGER_DEPLOY !== '0';

function die(msg){ console.error(msg); process.exit(1); }

if (!apiKey) die('RENDER_API_KEY required (Render Dashboard → Account Settings → API Keys)');
if (!telegramToken) die('TELEGRAM_TOKEN required');

async function renderFetch(path, opts){
  opts = opts || {};
  const res = await fetch(API + path, Object.assign({
    headers: {
      Authorization: 'Bearer ' + apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  }, opts));
  const text = await res.text();
  let body = null;
  try{ body = text ? JSON.parse(text) : null; }catch(e){ body = text; }
  if (!res.ok){
    die('Render API ' + res.status + ' ' + path + ': ' + (typeof body === 'string' ? body : JSON.stringify(body)).slice(0, 400));
  }
  return body;
}

async function resolveServiceId(){
  if (serviceId) return serviceId;
  let cursor = '';
  for (var page = 0; page < 20; page++){
    var q = '/services?limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    var list = await renderFetch(q);
    if (!Array.isArray(list)) die('unexpected services list response');
    for (var i = 0; i < list.length; i++){
      var item = list[i];
      var svc = item && item.service ? item.service : item;
      if (svc && svc.name === serviceName && svc.id) return svc.id;
    }
    cursor = list.length && list[list.length - 1].cursor ? list[list.length - 1].cursor : '';
    if (!cursor) break;
  }
  die('service not found: ' + serviceName + ' — set RENDER_SERVICE_ID');
}

async function putEnvVar(sid, key, value){
  await renderFetch('/services/' + sid + '/env-vars/' + encodeURIComponent(key), {
    method: 'PUT',
    body: JSON.stringify({ value: value }),
  });
  console.log('  set', key, '(value hidden)');
}

async function validateToken(token){
  const res = await fetch('https://api.telegram.org/bot' + encodeURIComponent(token) + '/getMe');
  const j = await res.json().catch(function(){ return null; });
  if (!res.ok || !(j && j.ok)){
    die('Telegram getMe failed: ' + ((j && j.description) || res.status));
  }
  console.log('  token ok — bot @' + (j.result && j.result.username ? j.result.username : '?'));
}

async function main(){
  console.log('== Render Telegram env setup ==');
  await validateToken(String(telegramToken).trim());
  const sid = await resolveServiceId();
  console.log('service:', serviceName, sid);
  await putEnvVar(sid, 'TELEGRAM_TOKEN', String(telegramToken).trim());
  if (telegramChatId){
    await putEnvVar(sid, 'TELEGRAM_CHAT_ID', String(telegramChatId).trim());
  }
  if (triggerDeploy){
    const dep = await renderFetch('/services/' + sid + '/deploys', { method: 'POST', body: '{}' });
    console.log('deploy triggered:', dep && dep.id ? dep.id : '(ok)');
  }
  console.log('done — verify: curl https://hardgate-main.onrender.com/api/notify/capabilities');
  console.log('expect "tokenOk": true');
}

main().catch(function(e){ die((e && e.message) || String(e)); });
