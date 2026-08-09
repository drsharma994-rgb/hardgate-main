/* HARDGATE — 24/7 AI AGENT workforce watch + Telegram on great setups.
   Runs headless agent swarm + Atomic Delta/CoinDCX scan on Render. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAgentSwarm } from './agent-brain.mjs';
import { getAtomicDesk } from './atomic-agent-scan.mjs';
import {
  AGENT_ALERT_GAP_MS,
  agentAlertsFresh,
  agentAlertsFormat,
  filterGreatSetups,
  mergeAgentSetups,
  normalizeAgentSetup,
} from './agent-alerts-core.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STATE_FILE = path.join(ROOT, 'scripts', '.agent-watch-state.json');
const INTERVAL_MS = +(process.env.HARDGATE_AGENT_WATCH_MS || AGENT_ALERT_GAP_MS);
const MIN_SCORE = +(process.env.HARDGATE_AGENT_ALERT_MIN_SCORE || 35);
const SITE = (process.env.HARDGATE_URL || process.env.RENDER_EXTERNAL_URL || 'https://hardgate-main.onrender.com/').replace(/\/?$/, '/');

let __busy = false;
let __timer = null;
let __armed = false;
let __lastCycle = null;

function loadState(){
  try{
    var d = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return (d && typeof d === 'object') ? d : {};
  }catch(e){ return {}; }
}

function saveState(st){
  try{ fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 2) + '\n'); }catch(e){}
}

async function sendTelegram(text){
  var token = process.env.TELEGRAM_TOKEN;
  var chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return 'not-configured';
  try{
    var r = await fetch('https://api.telegram.org/bot' + encodeURIComponent(token) + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: String(text || ''), disable_web_page_preview: true }),
    });
    if (!r.ok) return 'HTTP ' + r.status;
    var j = await r.json().catch(function(){ return null; });
    return (j && j.ok) ? true : 'api-error';
  }catch(e){
    return String((e && e.message) || e).slice(0, 120);
  }
}

function setupsFromSwarmResult(result){
  var out = [];
  if (!result || !result.desk) return out;
  var top = result.desk.topFindings || [];
  for (var i = 0; i < top.length; i++){
    var s = normalizeAgentSetup(top[i]);
    if (s) out.push(s);
  }
  if (result.agents){
    for (var id in result.agents){
      if (!Object.prototype.hasOwnProperty.call(result.agents, id)) continue;
      var ag = result.agents[id];
      var finds = (ag && ag.findings) ? ag.findings : [];
      for (var j = 0; j < finds.length; j++){
        var f = normalizeAgentSetup(Object.assign({}, finds[j], {
          agentId: id,
          agentLabel: ag.label || id,
        }));
        if (f) out.push(f);
      }
    }
  }
  return out;
}

function setupsFromAtomicDesk(desk){
  var out = [];
  if (!desk) return out;
  var best = desk.bestSetups || desk.topFindings || [];
  for (var i = 0; i < best.length; i++){
    var s = normalizeAgentSetup(Object.assign({}, best[i], {
      agentLabel: best[i].agentLabel || ('Atomic ' + (best[i].bestVenue || best[i].exchange || 'ranker')),
    }));
    if (s) out.push(s);
  }
  return out;
}

async function collectAllAgentSetups(siteUrl){
  var lists = [];
  try{
    var atomic = await getAtomicDesk(false);
    if (atomic && atomic.ok && atomic.desk) lists.push(setupsFromAtomicDesk(atomic.desk));
  }catch(e){}
  try{
    var swarm = await runAgentSwarm(siteUrl);
    if (swarm && swarm.ok) lists.push(setupsFromSwarmResult(swarm));
  }catch(e){}
  return mergeAgentSetups(lists);
}

async function cycle(){
  if (__busy) return;
  __busy = true;
  try{
    var st = loadState();
    var siteUrl = process.env.HARDGATE_URL || process.env.RENDER_EXTERNAL_URL || 'http://127.0.0.1:' + (process.env.PORT || 10000);
    var all = await collectAllAgentSetups(siteUrl);
    var great = filterGreatSetups(all, MIN_SCORE);
    var fr = agentAlertsFresh(st.keys || {}, great, Date.now(), INTERVAL_MS);
    console.log('[agent-watch] setups ' + all.length + ' · great ' + great.length + ' · fresh ' + fr.fresh.length
      + (st.seeded ? '' : ' (first cycle — seeding silently)'));
    var push = 'none';
    if (st.seeded && fr.fresh.length){
      var body = agentAlertsFormat(fr.fresh, SITE);
      if (body){
        var r = await sendTelegram(body);
        push = (r === true) ? 'telegram ok' : String(r);
        console.log('[agent-watch] push: ' + push);
      }
    }
    __lastCycle = {
      at: new Date().toISOString(),
      setups: all.length,
      great: great.length,
      fresh: fr.fresh.length,
      push: push,
    };
    saveState({ keys: fr.keys, seeded: true, at: __lastCycle.at });
  }catch(e){
    __lastCycle = { at: new Date().toISOString(), error: String((e && e.message) || e).slice(0, 160) };
    console.warn('[agent-watch] cycle failed (next in ' + (INTERVAL_MS / 60000) + ' min): ' + ((e && e.message) || e));
  }finally{
    __busy = false;
  }
}

export function agentWatchStatus(){
  return {
    armed: __armed,
    intervalMin: INTERVAL_MS / 60000,
    minScore: MIN_SCORE,
    telegramConfigured: !!(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID),
    lastCycle: __lastCycle,
  };
}

export function startAgentWatch(){
  if (__timer) return 'already running';
  if (!process.env.TELEGRAM_TOKEN || !process.env.TELEGRAM_CHAT_ID){
    console.log('[agent-watch] disabled — TELEGRAM_TOKEN / TELEGRAM_CHAT_ID not set');
    return 'disabled: no telegram env';
  }
  setTimeout(function(){ cycle(); }, 45000).unref?.();
  __timer = setInterval(function(){ cycle(); }, INTERVAL_MS);
  try{ __timer.unref(); }catch(e){}
  __armed = true;
  console.log('[agent-watch] armed — AI agent workforce every ' + (INTERVAL_MS / 60000) + ' min · min score ' + MIN_SCORE);
  return 'armed';
}

export { collectAllAgentSetups, cycle, INTERVAL_MS };
