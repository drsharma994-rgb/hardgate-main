/* HARDGATE — nightly formation rebake scheduler (Render-native).
   After 21:00 UTC, once per UTC day, POSTs local /api/formation-nightly/rebake.
   State: scripts/.formation-nightly-state.json. Zero deps. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nightlyDue } from '../lib/formation-nightly.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STATE = path.join(ROOT, 'scripts', '.formation-nightly-state.json');
const INTERVAL_MS = 15 * 60 * 1000;
const PORT = +(process.env.PORT || 10000);

let __busy = false;
let __timer = null;
let __armed = false;
let __lastCycle = null;

function loadState(){
  try{ return JSON.parse(fs.readFileSync(STATE, 'utf8')) || {}; }catch(e){ return {}; }
}
function saveState(st){
  try{ fs.writeFileSync(STATE, JSON.stringify(st)); }catch(e){}
}

async function cycle(){
  if (__busy) return;
  __busy = true;
  try{
    const st = loadState();
    const now = Date.now();
    if (!nightlyDue(st.lastAt, now)){
      __lastCycle = { at: new Date().toISOString(), action: 'idle', reason: 'not due' };
      return;
    }
    const res = await fetch('http://127.0.0.1:' + PORT + '/api/formation-nightly/rebake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    let j = null;
    try{ j = await res.json(); }catch(e){}
    __lastCycle = {
      at: new Date().toISOString(),
      action: res.ok ? 'rebaked' : 'failed',
      status: res.status,
      dayUtc: j && j.dayUtc
    };
    if (res.ok) saveState({ lastAt: new Date().toISOString(), dayUtc: j && j.dayUtc });
    console.log('[formation-nightly-watch] ' + __lastCycle.action + ' (http ' + res.status + ')');
  }catch(e){
    __lastCycle = { at: new Date().toISOString(), action: 'error', error: String((e && e.message) || e).slice(0, 120) };
    console.warn('[formation-nightly-watch] cycle failed: ' + ((e && e.message) || e));
  }finally{
    __busy = false;
  }
}

export function formationNightlyWatchStatus(){
  const st = loadState();
  return {
    armed: __armed,
    intervalMin: INTERVAL_MS / 60000,
    lastAt: st.lastAt || null,
    dayUtc: st.dayUtc || null,
    lastCycle: __lastCycle
  };
}

export function startFormationNightlyWatch(){
  if (__timer) return 'already running';
  setTimeout(function(){ cycle(); }, 120000).unref?.();
  __timer = setInterval(function(){ cycle(); }, INTERVAL_MS);
  try{ __timer.unref(); }catch(e){}
  __armed = true;
  console.log('[formation-nightly-watch] armed — after 21:00 UTC, once per UTC day');
  return 'armed';
}
