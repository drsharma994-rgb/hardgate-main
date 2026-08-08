/* HARDGATE — weekly LP digest scheduler (Render-native).
   GitHub cron is unreliable for exact weekly windows; this module runs inside
   the always-on web service and POSTs to the local book API when the weekly
   window opens (Sunday ~21:07 IST, same minute as the market daily digest).

   Requires LP_DIGEST_WEBHOOK_URL and/or TELEGRAM_TOKEN+TELEGRAM_CHAT_ID.
   Sends consolidated all-funds rollup unless LP_DIGEST_FUND is set (or pass fund in body).
   State: scripts/.book-digest-state.json (last send stamp). Zero deps. */

import { lpDigestDue } from '../lib/paperbook-core.mjs';
import {
  digestChannelsReady, loadDigestState, DIGEST_STATE_FILE,
} from '../lib/paperbook-digest.mjs';
import { apiAuthHeaders } from '../lib/api-auth.mjs';

const INTERVAL_MS = 15 * 60 * 1000;
const PORT = +(process.env.PORT || 10000);

let __busy = false;
let __timer = null;
let __armed = false;
let __lastCycle = null;

function localDigestUrl(){
  return 'http://127.0.0.1:' + PORT + '/api/book/digest/send';
}

async function cycle(){
  if (__busy) return;
  __busy = true;
  try{
    var st = loadDigestState();
    var now = Date.now();
    if (!lpDigestDue(st.lastAt, now)){
      __lastCycle = { at: new Date().toISOString(), action: 'idle', reason: 'not due' };
      return;
    }
    var res = await fetch(localDigestUrl(), {
      method: 'POST',
      headers: apiAuthHeaders(),
      body: JSON.stringify({ period: 'week', cron: true }),
    });
    var j = null;
    try{ j = await res.json(); }catch(e){}
    __lastCycle = {
      at: new Date().toISOString(),
      action: (j && j.skipped) ? 'skipped' : (res.ok ? 'sent' : 'failed'),
      status: res.status,
      channels: j && j.channels,
    };
    console.log('[book-digest-watch] ' + __lastCycle.action + ' (http ' + res.status + ')');
  }catch(e){
    __lastCycle = { at: new Date().toISOString(), action: 'error', error: String((e && e.message) || e).slice(0, 120) };
    console.warn('[book-digest-watch] cycle failed: ' + ((e && e.message) || e));
  }finally{
    __busy = false;
  }
}

function bookDigestWatchStatus(){
  var st = loadDigestState();
  return {
    armed: __armed,
    intervalMin: INTERVAL_MS / 60000,
    channelsReady: digestChannelsReady(),
    stateFile: DIGEST_STATE_FILE.split('/').pop(),
    lastSentAt: st.lastAt || null,
    lastCycle: __lastCycle,
  };
}

function startBookDigestWatch(){
  if (__timer) return 'already running';
  if (!digestChannelsReady()){
    console.log('[book-digest-watch] disabled — set LP_DIGEST_WEBHOOK_URL, Telegram, and/or LP_DIGEST_EMAIL_TO + email provider');
    return 'disabled: no digest channels';
  }
  setTimeout(function(){ cycle(); }, 90000).unref?.();
  __timer = setInterval(function(){ cycle(); }, INTERVAL_MS);
  try{ __timer.unref(); }catch(e){}
  __armed = true;
  console.log('[book-digest-watch] armed — weekly consolidated LP digest every 15 min (Sun ~21:07 IST) unless LP_DIGEST_FUND is set');
  return 'armed';
}

export { startBookDigestWatch, bookDigestWatchStatus, INTERVAL_MS, cycle };
