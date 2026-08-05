/* HARDGATE — SQUEEZE WATCH (Render-native, every 5 minutes).
   The owner asked for fired-squeeze Telegram alerts on a TRUE 5-minute
   cadence — GitHub's scheduled cron cannot honor that (measured 3.5h gaps
   on 2026-07-29), so this scanner lives inside the always-on Render web
   service (scripts/server.mjs starts it).

   Every 5 minutes: Binance USDT-perp universe ($30M+ 24h turnover, top 60 —
   the same filter as the SQUEEZE tab) -> 4h klines -> the app's OWN
   squeezeClassify (indicators.js + indicators2.js + squeeze.js loaded into
   a vm sandbox, zero code duplication) -> FIRED_LONG / FIRED_SHORT rows.

   Alert identity is the FIRE BAR (sym:dir:barOpenTime): one push per fire,
   never a 5-min repeat of the same fire. First cycle after a (re)start
   seeds silently. Levels: house ATR plan (entry last close, stop 1.5×ATR14,
   T1 2R, T2 3.5R) — the same fallback as squeeze.js's own planner.

   Telegram goes direct (bot API), env TELEGRAM_TOKEN / TELEGRAM_CHAT_ID —
   missing envs disable the watcher honestly at boot. State persists to a
   local JSON (ephemeral per deploy; a redeploy re-seeds silently).
   Zero deps, Node 18+ global fetch. Never throws at load. */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { telegramPlanBlock } from '../lib/telegram-plan.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STATE_FILE = path.join(ROOT, 'scripts', '.squeeze-watch-state.json');

const INTERVAL_MS   = 5 * 60 * 1000;
const MIN_TURNOVER  = 30e6;      /* same floor as squeeze.js */
const MAX_UNIVERSE  = 60;        /* same cap as squeeze.js */
const KL_4H_LIMIT   = 220;       /* same depth as squeeze.js */
const CHUNK         = 8;
const CHUNK_SLEEP_MS = 400;
const FETCH_MS      = 12000;
const ATR_LEN       = 14, STOP_ATR = 1.5, T1_R = 2, T2_R = 3.5;
const SITE          = process.env.HARDGATE_URL || 'https://hardgate-main.onrender.com/';

/* ---------------- module loading (app's own classifier, untampered) -------- */
let __classify = null, __atr = null;
function loadScanners(){
  if (__classify) return;
  const sandbox = { console, Math, JSON, Date, Array, Object, Number, String, isFinite, parseFloat, parseInt,
                    Promise, setTimeout, Error };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const f of ['indicators.js', 'indicators2.js', 'squeeze.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
  }
  if (typeof sandbox.squeezeClassify !== 'function') throw new Error('squeezeClassify not exposed');
  __classify = sandbox.squeezeClassify;
  __atr = (typeof sandbox.atr === 'function') ? sandbox.atr : null;
}

/* ---------------- pure helpers (exported for the vm suites) ---------------- */
function fireKey(f){ return f.sym + ':' + f.dir + ':' + f.fireBarT; }

/* diff the current fire set against remembered keys: new fires only.
   Memory capped to keys seen in the last 48h (a 4h fire bar is 12 cycles). */
function newFires(prevKeys, fires, now){
  const keys = {}, cutoff = now - 48 * 3600 * 1000, fresh = [];
  for (const k of Object.keys(prevKeys || {})){
    const t = +prevKeys[k];
    if (Number.isFinite(t) && t > cutoff) keys[k] = t;
  }
  for (const f of (Array.isArray(fires) ? fires : [])){
    const k = fireKey(f);
    if (keys[k] === undefined){ fresh.push(f); keys[k] = now; }
  }
  return { fresh, keys };
}

/* house ATR plan — identical shape to squeeze.js's fallback: entry = last
   close, stop 1.5×ATR14 against direction, T1 2R, T2 3.5R. Null when the
   math can't honestly produce levels. */
function atrPlan(atrFn, rows, dir){
  try{
    if (dir !== 'long' && dir !== 'short') return null;
    if (!atrFn || !Array.isArray(rows) || rows.length < ATR_LEN + 1) return null;
    const a = +atrFn(rows, ATR_LEN)[rows.length - 1];
    const entry = +rows[rows.length - 1].c;
    if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(entry) || entry <= 0) return null;
    const stop = dir === 'long' ? entry - STOP_ATR * a : entry + STOP_ATR * a;
    const risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    return { entry, stop,
             t1: dir === 'long' ? entry + T1_R * risk : entry - T1_R * risk,
             t2: dir === 'long' ? entry + T2_R * risk : entry - T2_R * risk };
  }catch(e){ return null; }
}

/* compact price: 6 significant digits, trailing zeros trimmed */
function fmtL(n){
  if (n === null || n === undefined) return '—';
  const v = +n;
  return Number.isFinite(v) ? String(+v.toPrecision(6)) : '—';
}

/* leverage idea — same house rule as alert-check: stop-out ≈ 1% of account,
   1x floor, 30x cap. Null when the levels can't produce an honest number. */
function levIdea(entry, stop){
  const e = +entry, st = +stop;
  if (!Number.isFinite(e) || !Number.isFinite(st) || e <= 0) return null;
  const riskPct = Math.abs(e - st) / e;
  if (!(riskPct > 0)) return null;
  return Math.max(1, Math.min(30, Math.floor(0.01 / riskPct)));
}

function watchBody(fires){
  const lines = fires.slice(0, 6).map(function(f){
    const p = f.plan;
    const lev = p ? levIdea(p.entry, p.stop) : null;
    const head = '· ' + f.sym + ' ' + f.dir.toUpperCase() + ' — TTM squeeze FIRED (4h, ' + f.firedAgo
      + ' bar' + (f.firedAgo === 1 ? '' : 's') + ' ago)';
    if (p && Number.isFinite(+p.entry) && Number.isFinite(+p.stop) && Number.isFinite(+p.t1)){
      return head + '\n' + telegramPlanBlock({ sym: f.sym, dir: f.dir, entry: p.entry, stop: p.stop, t1: p.t1, t2: p.t2 })
        + (lev !== null ? '\nlev ~' + lev + 'x' : '');
    }
    return head + '\nCOIN: ' + f.sym + '\nSIDE: ' + f.dir.toUpperCase()
      + '\nENTRY / STOP LOSS / TAKE PROFIT: open the SQUEEZE tab';
  });
  return lines.join('\n') + (fires.length > 6 ? '\n+' + (fires.length - 6) + ' more' : '')
    + '\nlev ~Nx = stop-out ≈ 1% of account (cap 30x)'
    + '\n' + SITE;
}

/* ---------------- fetch layer ---------------- */
async function fetchJson(url, ms){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || FETCH_MS);
  try{
    const r = await fetch(url, { signal: ctrl.signal,
      headers: { 'User-Agent': 'hardgate-squeeze-watch/1.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  }finally{ clearTimeout(timer); }
}

async function universe(){
  const ticks = await fetchJson('https://fapi.binance.com/fapi/v1/ticker/24hr', 20000);
  if (!Array.isArray(ticks)) throw new Error('bad ticker payload');
  return ticks
    .filter(t => t && typeof t.symbol === 'string' && t.symbol.endsWith('USDT')
              && Number.isFinite(+t.quoteVolume) && +t.quoteVolume >= MIN_TURNOVER)
    .sort((a, b) => (+b.quoteVolume) - (+a.quoteVolume))
    .slice(0, MAX_UNIVERSE)
    .map(t => t.symbol);
}

async function klines4h(sym){
  const raw = await fetchJson('https://fapi.binance.com/fapi/v1/klines?symbol=' + sym
    + '&interval=4h&limit=' + KL_4H_LIMIT);
  if (!Array.isArray(raw)) throw new Error('bad klines');
  return raw.map(k => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }))
            .filter(r => Number.isFinite(r.c) && Number.isFinite(r.h) && Number.isFinite(r.l));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* one scan pass -> the fire set [{sym, dir, firedAgo, fireBarT, plan}] */
async function scanFires(){
  loadScanners();
  const uni = await universe();
  const fires = [];
  for (let i = 0; i < uni.length; i += CHUNK){
    await Promise.all(uni.slice(i, i + CHUNK).map(async function(sym){
      try{
        const rows = await klines4h(sym);
        if (rows.length < 60) return;
        const cls = __classify(rows, []);   /* 1d leg skipped: fires don't need it; trendAgree stays null */
        const dir = cls && cls.state === 'FIRED_LONG' ? 'long'
                  : cls && cls.state === 'FIRED_SHORT' ? 'short' : null;
        if (!dir || !(cls.firedAgo >= 0)) return;
        const fireBar = rows[rows.length - 1 - cls.firedAgo];
        fires.push({ sym, dir, firedAgo: cls.firedAgo,
                     fireBarT: fireBar ? +fireBar.t : 0,
                     plan: atrPlan(__atr, rows, dir) });
      }catch(e){ /* one symbol's failure never kills the pass */ }
    }));
    if (i + CHUNK < uni.length) await sleep(CHUNK_SLEEP_MS);
  }
  return fires;
}

/* ---------------- telegram ---------------- */
async function sendTelegram(text){
  const token = process.env.TELEGRAM_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return 'not-configured';
  try{
    const r = await fetch('https://api.telegram.org/bot' + encodeURIComponent(token) + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: String(text || ''), disable_web_page_preview: true })
    });
    if (!r.ok) return 'HTTP ' + r.status;
    const j = await r.json().catch(() => null);
    return (j && j.ok) ? true : 'api-error';
  }catch(e){ return String((e && e.message) || e).slice(0, 120); }
}

/* ---------------- state ---------------- */
function loadWatchState(){
  try{
    const d = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return (d && typeof d === 'object') ? d : {};
  }catch(e){ return {}; }
}
function saveWatchState(st){
  try{ fs.writeFileSync(STATE_FILE, JSON.stringify(st)); }catch(e){}
}

/* ---------------- the loop ---------------- */
let __busy = false, __timer = null, __armed = false;
let __lastCycle = null;   /* {at, fires, fresh, push} — counts only, no secrets */
async function cycle(){
  if (__busy) return;
  __busy = true;
  try{
    const st = loadWatchState();
    const fires = await scanFires();
    const { fresh, keys } = newFires(st.keys, fires, Date.now());
    console.log('[squeeze-watch] ' + fires.length + ' live fires · ' + fresh.length + ' new'
      + (st.seeded ? '' : ' (first cycle — seeding silently)'));
    let push = 'none';
    if (st.seeded && fresh.length){
      const r = await sendTelegram('🌀 HARDGATE SQUEEZE FIRED\n' + watchBody(fresh));
      push = (r === true) ? 'telegram ok' : String(r);
      console.log('[squeeze-watch] push: ' + push);
    }
    __lastCycle = { at: new Date().toISOString(), fires: fires.length, fresh: fresh.length, push: push };
    saveWatchState({ keys, seeded: true, at: new Date().toISOString() });
  }catch(e){
    __lastCycle = { at: new Date().toISOString(), error: String((e && e.message) || e).slice(0, 120) };
    console.warn('[squeeze-watch] cycle failed (next in 5 min): ' + ((e && e.message) || e));
  }finally{ __busy = false; }
}

/* status for GET /api/squeeze-watch — armed flag + last cycle counts.
   Never exposes env values, keys, or symbol-level state. */
function squeezeWatchStatus(){
  return { armed: __armed, intervalMin: INTERVAL_MS / 60000,
           telegramConfigured: !!(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID),
           lastCycle: __lastCycle };
}

/* started by scripts/server.mjs when TELEGRAM_TOKEN + TELEGRAM_CHAT_ID are
   set; honest no-op otherwise. Returns a status string for the boot log. */
function startSqueezeWatch(){
  if (__timer) return 'already running';
  if (!process.env.TELEGRAM_TOKEN || !process.env.TELEGRAM_CHAT_ID){
    console.log('[squeeze-watch] disabled — TELEGRAM_TOKEN / TELEGRAM_CHAT_ID not set in the environment');
    return 'disabled: no telegram env';
  }
  try{ loadScanners(); }catch(e){
    console.warn('[squeeze-watch] scanner load failed: ' + ((e && e.message) || e));
    return 'disabled: scanner load failed';
  }
  /* first cycle ~20s after boot (let the service settle), then every 5 min */
  setTimeout(() => { cycle(); }, 20000).unref?.();
  __timer = setInterval(() => { cycle(); }, INTERVAL_MS);
  try{ __timer.unref(); }catch(e){}
  __armed = true;
  console.log('[squeeze-watch] armed — 5-min fired-squeeze scan, Telegram direct');
  return 'armed';
}

export { fireKey, newFires, atrPlan, fmtL, watchBody, scanFires, startSqueezeWatch, squeezeWatchStatus, INTERVAL_MS };
