import fs from 'fs';
import { pathToFileURL } from 'url';

const SITE_URL = process.env.HARDGATE_URL || 'https://hardgate-main.onrender.com/';
const STATE_FILE = 'alert-state.json';
/* Owner Telegram defaults — used when TELEGRAM_TOKEN/TELEGRAM_CHAT_ID env
   secrets are unset (browser page + CI runner). */
const HG_TG_DEFAULT_TOKEN = '8678184060:AAGKhoukjgitAAk8kMzPHRF3WF6U8oXaNcc';
const HG_TG_DEFAULT_CHAT = '1004014764';
/* GitHub auto-disables scheduled workflows after 60 days of repository
   inactivity. The heartbeat below stamps lastRunAt into alert-state.json at
   most once per 24h, so the workflow's commit step produces ~1 keep-alive
   commit/day instead of one every 15 minutes. */
const HEARTBEAT_MS = 24 * 60 * 60 * 1000;

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    return { delta: null, coindcx: null, gold: null, tabAlerts: null };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

/* true when the committed state's lastRunAt is missing/unparseable or older
   than 24h -> time for a fresh keep-alive stamp. */
function needsHeartbeat(state, now) {
  const ts = Date.parse((state && state.lastRunAt) || '');
  return !Number.isFinite(ts) || (now - ts) > HEARTBEAT_MS;
}

/* Email gate on window.__hgLastEmail ({ok, err, ts} — set by the page's email
   senders after every send attempt). Missing/malformed -> warn only (no send
   was attempted this cycle, or the page isn't instrumented yet); ok:false ->
   hard fail so the GitHub run goes red. */
function emailVerdict(email) {
  if (!email || typeof email.ok !== 'boolean') return { fail: false, warn: true };
  if (email.ok === false) return { fail: true, err: email.err || 'unknown error' };
  return { fail: false };
}

/* ---------------- off-hours session tag ----------------
   Same windows as brain.js sessionWindow (IST): Sunday, or 01:00-06:30 IST.
   Off-hours alerts are never SUPPRESSED — the brain already haircut the tier;
   the push is TAGGED so the size discipline travels with the message. */
function istOffHours(now) {
  try {
    const ist = new Date((now === undefined || now === null ? Date.now() : +now) + 5.5 * 3600 * 1000);
    const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    return (ist.getUTCDay() === 0) || (mins >= 60 && mins <= 390);
  } catch (e) { return false; }
}
function offHoursPrefix(now) { return istOffHours(now) ? '⚠️ OFF-HOURS · ' : ''; }
function offHoursTag(now) {
  return istOffHours(now)
    ? '\n⚠️ OFF-HOURS tape (Sun / 01:00-06:30 IST) — brain conviction haircut applied; half size or skip'
    : '';
}

/* ---------------- entry-ticket watch (server-side) ----------------
   The CI run completes a full brain synthesis in the page and reads
   window.__hgBrainTicketNow() -> {at, long:{sym,entry}|null, short:{...}|null}.
   Only sym/entry per side is persisted/compared — same key semantics as the
   in-browser hgalert TICKET class: a new symbol, a moved entry, or a side
   appearing/vanishing is a change. First recorded state seeds silently. */
function ticketSide(s) {
  return (s && s.sym != null && Number.isFinite(+s.entry))
    ? { sym: String(s.sym), entry: +s.entry }
    : null;
}
function ticketSnapshot(raw) {
  return { long: ticketSide(raw && raw.long), short: ticketSide(raw && raw.short) };
}
function ticketChanged(prev, next) {
  return JSON.stringify(ticketSnapshot(prev)) !== JSON.stringify(ticketSnapshot(next));
}
function ticketPushBody(next) {
  const t = ticketSnapshot(next);
  const fmt = (s) => (s ? s.sym + ' @ ' + s.entry : '—');
  return 'Long: ' + fmt(t.long) + '\nShort: ' + fmt(t.short);
}
/* ntfy push straight from Node (no page needed). No topic -> honest skip. */
async function sendNtfy(topic, title, body) {
  if (!topic) return 'skipped: no NTFY_TOPIC secret configured';
  try {
    const res = await fetch('https://ntfy.sh/' + encodeURIComponent(topic), {
      method: 'POST',
      headers: {
        'Title': String(title || 'HARDGATE alert'),
        'Priority': '4',
        'Tags': 'chart_with_upwards_trend',
        'Click': SITE_URL
      },
      body: String(body || '')
    });
    return (res && res.status >= 200 && res.status < 300) ? 'sent' : 'failed: HTTP ' + (res && res.status);
  } catch (e) {
    return 'failed: ' + ((e && e.message) ? e.message : String(e));
  }
}
/* Telegram straight from Node — the owner's primary channel (2026-07-25:
   chosen over email after the EmailJS quota died). Env secrets win; else the
   baked-in HG_TG_DEFAULT_* owner defaults. Only skips when both are absent. */
async function sendTelegramCi(text) {
  const t = process.env.TELEGRAM_TOKEN || HG_TG_DEFAULT_TOKEN;
  const c = process.env.TELEGRAM_CHAT_ID || HG_TG_DEFAULT_CHAT;
  if (!t || !c) return 'skipped: no TELEGRAM_TOKEN/TELEGRAM_CHAT_ID secrets configured';
  try {
    const res = await fetch('https://api.telegram.org/bot' + t + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: c, text: String(text || ''), disable_web_page_preview: true })
    });
    return (res && (res.ok === true || (res.status >= 200 && res.status < 300))) ? 'sent'
      : 'failed: HTTP ' + (res && (res.status !== undefined ? res.status : '?'));
  } catch (e) {
    return 'failed: ' + ((e && e.message) ? e.message : String(e));
  }
}
/* CI alert cascade: Telegram first, ntfy as the second free channel. The
   result string always names both channels honestly. */
async function sendAlertCi(title, body) {
  const tg = await sendTelegramCi(title + '\n' + body + '\n' + SITE_URL);
  if (tg === 'sent') return 'telegram: sent';
  const nt = await sendNtfy(process.env.NTFY_TOPIC || '', title, body);
  return 'telegram ' + tg + ' · ntfy ' + nt;
}
async function sendTicketPush(topic, next) {
  return sendNtfy(topic, 'HARDGATE entry ticket changed', ticketPushBody(next));
}

/* ---------------- engine-outage watchdog ----------------
   The CI run completes a full brain synthesis; a synthesis finishing with
   engineState null (or a stale snapshot) means 500+ contracts just lost
   their structural voter — the 2026-07-25 all-ASIDE outage class. Push
   throttled to one per ENGINE_ALERT_MS per continuous outage; recovery
   clears the stamp. */
const ENGINE_STALE_MS = 30 * 60 * 1000; /* aligned with engine.js ENGINE_FRESH_MS */
const ENGINE_ALERT_MS = 2 * 60 * 60 * 1000;
function engineVerdict(engine, now) {
  if (!engine || engine.live !== true) {
    return { ok: false, why: 'engineState null after a completed synthesis — the gate scan is not publishing' };
  }
  const age = Number.isFinite(+engine.at) ? (now - +engine.at) : Infinity;
  if (!(age >= 0 && age <= ENGINE_STALE_MS)) {
    return { ok: false, why: 'engineState stale (' + (Number.isFinite(age) ? Math.round(age / 60000) : '?') + 'm old) — survivors are not being refreshed' };
  }
  return { ok: true, survivors: Number.isFinite(+engine.survivors) ? +engine.survivors : 0 };
}
function engineAlertDue(lastAlertAt, now) {
  const t = Date.parse(lastAlertAt || '');
  return !Number.isFinite(t) || (now - t) > ENGINE_ALERT_MS;
}

/* ---------------- ntfy fallback for setup alerts ----------------
   When the EmailJS send fails (e.g. the monthly quota the 2026-07-25 run
   exposed), the NEW setup still reaches the owner via ntfy — once per
   setup per leg, stamped in alert-state.json so 15-min retries of the
   same dead email channel never spam. Pure selector, testable. */
function fallbackLegs(prev, curr) {
  const out = [];
  const prevFb = (prev && typeof prev.ntfyFallback === 'object' && prev.ntfyFallback) || {};
  for (const leg of ['delta', 'coindcx', 'gold']) {
    const key = curr ? (curr[leg] ?? null) : null;
    if (!key) continue;                                                        /* no setup on this leg */
    if (JSON.stringify((prev || {})[leg] ?? null) === JSON.stringify(key)) continue;  /* not new this run */
    if (prevFb[leg] && JSON.stringify(prevFb[leg].key) === JSON.stringify(key)) continue; /* already pushed */
    out.push({ leg, key });
  }
  return out;
}

/* ---------------- sniper-grade hits (server-side) ----------------
   Key semantics mirror the in-browser hgalert SNIPER class: sym@entry per
   hit, sorted. First sighting seeds silently; a changed NON-EMPTY set
   pushes (Telegram first via sendAlertCi); an empty set never pushes. */
function sniperKey(hits) {
  const parts = [];
  for (const h of (Array.isArray(hits) ? hits : [])) {
    if (h && h.sym && Number.isFinite(+h.entry)) parts.push(String(h.sym) + '@' + String(+h.entry));
  }
  parts.sort();
  return parts.join(';');
}
function sniperBody(hits) {
  var lines = hits.slice(0, 5).map(function(h){
    return h.sym + ' ' + String(h.dir || '').toUpperCase() + ' @ ' + h.entry
      + ' (' + (h.lev || '?') + 'x, ' + (h.state || '?') + ') · stop ' + h.stop + ' · T1 ' + h.t1;
  });
  var body = lines.join('\n') + (hits.length > 5 ? '\n+' + (hits.length - 5) + ' more' : '');
  try{
    var vu = new Date(Date.now() + 24 * 3600 * 1000 + 5.5 * 3600 * 1000);   /* IST */
    body += '\nvalid until ~' + ('0' + vu.getUTCHours()).slice(-2) + ':' + ('0' + vu.getUTCMinutes()).slice(-2)
      + ' IST tomorrow (24h limit validity, or until structure breaks)';
  }catch(e){}
  return body;
}

/* ---------------- squeeze setups (server-side) ----------------
   Key semantics mirror the in-browser hgalert SQUEEZE class: sym:dir per
   fired/break row, sorted. First sighting seeds silently; a changed
   NON-EMPTY set pushes (Telegram first via sendAlertCi); empty never pushes.
   The page read carries no levels (sqWarm publishes sym/dir/kind only), so
   the body honestly points at the SQUEEZE tab for entries/stops. */
function squeezeKey(rows) {
  const parts = [];
  for (const r of (Array.isArray(rows) ? rows : [])) {
    if (r && r.sym && (r.dir === 'long' || r.dir === 'short')
        && (r.kind === 'fired' || r.kind === 'break'))
      parts.push(String(r.sym) + ':' + r.dir);
  }
  parts.sort();
  return parts.join(';');
}
function squeezeBody(rows) {
  var lines = rows.slice(0, 5).map(function(r){
    return r.sym + ' ' + String(r.dir || '').toUpperCase()
      + ' (' + (r.kind === 'break' ? 'DONCHIAN BREAK' : 'FIRED') + ')';
  });
  return lines.join('\n') + (rows.length > 5 ? '\n+' + (rows.length - 5) + ' more' : '')
    + '\nlevels on the SQUEEZE tab — entry/stop/targets live there.';
}

/* ---------------- confirmed setups sweep (server-side) ----------------
   Every 15-min run collects VALID + CONFIRMED setups WITH levels from the
   page's own state seams: BRAIN PRIME/HIGH rows with plans, and EXECUTE
   survivors (6/6 gates) with plans. Same sym+dir across sources merges into
   one line with both badges. Only setups with finite entry/stop/t1 qualify
   (the owner's TP+SL requirement); t2 rides along when present.
   Alert memory: a setup key (sym:dir@entry) pushes ONCE per 24h — new
   formations push as they appear; unchanged boards never re-spam. */
const SETUP_REMIND_MS = 24 * 3600 * 1000;
function mergeSetups(list) {
  const m = new Map();
  for (const s of (Array.isArray(list) ? list : [])) {
    if (!s || !s.sym) continue;
    if (s.entry === null || s.entry === undefined || s.stop === null || s.stop === undefined
        || s.t1 === null || s.t1 === undefined) continue;
    const e = +s.entry, st = +s.stop, t1 = +s.t1;
    if (!Number.isFinite(e) || !Number.isFinite(st) || !Number.isFinite(t1) || e === st) continue;
    const k = String(s.sym) + ':' + String(s.dir || '');
    const cur = m.get(k);
    if (cur) { if (s.src && cur.src.indexOf(s.src) === -1) cur.src += ' + ' + s.src; continue; }
    m.set(k, { sym: String(s.sym), dir: String(s.dir || ''), src: String(s.src || ''),
               entry: e, stop: st, t1: t1, t2: Number.isFinite(+s.t2) ? +s.t2 : null });
  }
  return [...m.values()];
}
function setupKey(s) { return s.sym + ':' + s.dir + '@' + s.entry; }
function freshSetups(prevKeys, list, now) {
  const keys = {}, cutoff = now - SETUP_REMIND_MS, fresh = [];
  for (const k of Object.keys(prevKeys || {})) {
    const t = +prevKeys[k];
    if (Number.isFinite(t) && t > cutoff) keys[k] = t;
  }
  for (const s of (Array.isArray(list) ? list : [])) {
    const k = setupKey(s);
    if (keys[k] === undefined) { fresh.push(s); keys[k] = now; }
  }
  return { fresh, keys };
}
/* leverage idea: the leverage at which a stop-out costs ~1% of account
   equity (position notional = lev × margin; SL distance% × lev = equity hit).
   Floored at 1x, capped at 30x (owner's stated band). Null when the levels
   can't honestly produce a number. */
function levIdea(entry, stop) {
  const e = +entry, st = +stop;
  if (!Number.isFinite(e) || !Number.isFinite(st) || e <= 0) return null;
  const riskPct = Math.abs(e - st) / e;
  if (!(riskPct > 0)) return null;
  return Math.max(1, Math.min(30, Math.floor(0.01 / riskPct)));
}
function levText(entry, stop) {
  const l = levIdea(entry, stop);
  return l === null ? '' : ' · lev ~' + l + 'x';
}
function setupsBody(list) {
  const lines = list.slice(0, 8).map(function(s){
    return '· ' + s.sym + ' ' + String(s.dir || '').toUpperCase() + ' [' + s.src + ']'
      + ' @ ' + s.entry + ' · SL ' + s.stop + ' · TP ' + s.t1
      + (s.t2 !== null ? ' · T2 ' + s.t2 : '')
      + levText(s.entry, s.stop);
  });
  return lines.join('\n') + (list.length > 8 ? '\n+' + (list.length - 8) + ' more' : '')
    + '\nlev ~Nx = stop-out ≈ 1% of account (cap 30x) — size down if you risk less.';
}

/* ---------------- DAILY DIGEST ----------------
   Once per day (~21:07 IST, inside the 15-min runs), a full-market summary
   push: market read, entry ticket, sniper hits, engine, top planned rows.
   Pure body composition (testable); the push itself is a daily, never
   throttled. Stamp rides alert-state.json so exactly one digest per day. */
const DIGEST_HOUR_UTC = 15, DIGEST_MIN_UTC = 37;   /* 21:07 IST, off-peak minute */
const DIGEST_WINDOW_MIN = 45;
function digestDue(lastDigestAt, now) {
  const d = new Date(now);
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  const start = DIGEST_HOUR_UTC * 60 + DIGEST_MIN_UTC;
  if (!(mins >= start && mins <= start + DIGEST_WINDOW_MIN)) return false;
  const t = Date.parse(lastDigestAt || '');
  return !Number.isFinite(t) || (now - t) > 20 * 60 * 60 * 1000;
}
function ticketLine(t) {
  const f = (s) => (s ? s.sym + ' @ ' + s.entry : '—');
  return 'LONG ' + f(t && t.long) + ' · SHORT ' + f(t && t.short);
}
function digestBody(info) {
  const lines = [];
  const dt = new Date(info.now + 5.5 * 3600 * 1000);   /* IST stamp */
  const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getUTCDay()];
  lines.push(day + ' ' + String(dt.getUTCDate()).padStart(2, '0') + '/'
    + String(dt.getUTCMonth() + 1).padStart(2, '0') + ' '
    + String(dt.getUTCHours()).padStart(2, '0') + ':' + String(dt.getUTCMinutes()).padStart(2, '0') + ' IST');
  lines.push('Market: ' + (info.read || '—'));
  lines.push('Ticket: ' + ticketLine(info.ticket));
  lines.push('Sniper-grade: ' + (info.sniper && info.sniper.length
    ? info.sniper.map(function(h){ return h.sym + ' ' + String(h.dir || '').toUpperCase() + ' @ ' + h.entry + ' (' + (h.lev || '?') + 'x)'; }).join(' · ')
    : 'none right now'));
  lines.push('Engine: ' + (info.engineOk ? (info.survivors + ' survivors voting') : 'DARK — check the app'));
  /* hosting health — the daily "you'd notice a Render pause here" line.
     probe: {ok, status, ms} from a timed GET of the site root, taken just
     before the digest composes (pure render below; the probe lives in main). */
  if (info.hosting){
    const h = info.hosting;
    lines.push('Hosting: ' + (h.ok
      ? 'Render UP · http ' + h.status + ' · ' + (h.ms / 1000).toFixed(1) + 's'
      : 'DEGRADED — ' + (h.status ? 'http ' + h.status : (h.err || 'unreachable'))
        + ' — if this repeats, check the Render dashboard'));
  }
  if (info.top && info.top.length){
    lines.push('Top plans:');
    for (const r of info.top){
      lines.push('· ' + r.sym + ' ' + String(r.dir || '').toUpperCase() + ' (' + r.tier + ') @ ' + r.entry
        + ' · stop ' + r.stop + ' · T1 ' + r.t1);
    }
  } else {
    lines.push('Top plans: none — standing aside is a position.');
  }
  if (info.prevTicket) lines.push('Last digest ticket: ' + ticketLine(info.prevTicket));
  return lines.join('\n');
}

async function main() {
  // dynamic import: keeps this module loadable without puppeteer installed
  // (tests import the pure helpers above); CI installs puppeteer before running.
  const { default: puppeteer } = await import('puppeteer');

  const prevState = loadState();
  console.log('Previous alert state:', JSON.stringify(prevState));

  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 540000,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', (msg) => console.log('[page]', msg.text()));
  page.on('pageerror', (err) => console.error('[page error]', err.message));

  const cacheBuster = Date.now();
  /* Telegram channel: the page's alert cycle prefers Telegram when creds are
     present — inject the repo secrets into page storage BEFORE any script
     runs, so CI sends natively (full levels in the message), the
     __hgLastEmail gate reads ok via the telegram channel, and the run is
     green regardless of EmailJS quota. Unset secrets = page uses email. */
  if (process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    await page.evaluateOnNewDocument((t, c) => {
      try { localStorage.setItem('hg_tg_token', t); localStorage.setItem('hg_tg_chat', c); } catch (e) {}
    }, process.env.TELEGRAM_TOKEN, process.env.TELEGRAM_CHAT_ID);
  } else {
    await page.evaluateOnNewDocument((t, c) => {
      try { localStorage.setItem('hg_tg_token', t); localStorage.setItem('hg_tg_chat', c); } catch (e) {}
    }, HG_TG_DEFAULT_TOKEN, HG_TG_DEFAULT_CHAT);
  }
  if (prevState.tabAlerts) {
    await page.evaluateOnNewDocument((keys) => {
      try { localStorage.setItem('hg_tabalert_keys', JSON.stringify(keys)); } catch (e) {}
    }, prevState.tabAlerts);
  }
  await page.goto(SITE_URL + '?nocache=' + cacheBuster, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForSelector('#bestRun', { timeout: 30000 });
  // small settle delay so init scripts (emailjs.init, exchange setup) finish running
  await new Promise((r) => setTimeout(r, 3000));

  const result = await page.evaluate(async (prev) => {
    if (typeof S !== 'undefined' && S.lastAlertKey) {
      S.lastAlertKey.delta = prev.delta;
      S.lastAlertKey.coindcx = prev.coindcx;
      if ('gold' in S.lastAlertKey) S.lastAlertKey.gold = prev.gold ?? null;
    }
    await runAlertCycle();
    let edgeInfo = null;
    try{
      const es = (typeof edgeScan === 'function') ? edgeScan() : null;
      edgeInfo = { at: es && es.at, count: (es && Array.isArray(es.cands)) ? es.cands.length : 0 };
    }catch(e){ edgeInfo = { err: String(e && e.message ? e.message : e) }; }
    // window.__hgLastEmail = {ok, err, ts} from the page's senders — read AFTER
    // the cycle so any send attempt this run is captured. If several sends fire
    // in one cycle this holds the LAST one (contract limitation).
    const email = (typeof window !== 'undefined' && window.__hgLastEmail) ? window.__hgLastEmail : null;
    let tabAlerts = null;
    try { tabAlerts = JSON.parse(localStorage.getItem('hg_tabalert_keys') || 'null'); } catch (e) { tabAlerts = null; }
    return {
      state: { delta: S.lastAlertKey.delta, coindcx: S.lastAlertKey.coindcx, gold: S.lastAlertKey.gold ?? null },
      email: email,
      tabAlerts: tabAlerts,
      edge: edgeInfo
    };
  }, prevState);

  /* entry-ticket watch: mount the BRAIN pane offscreen, run ONE full
     synthesis (bounded), read the painted ticket snapshot. The page's own
     alert engine stays unarmed in CI (no gesture), so no double-notify:
     the push below is the only ticket channel here. A slow/failed synthesis
     degrades to a logged warn and no state change — never a red run. */
  const ticketResult = await page.evaluate(async () => {
    try {
      const mods = (typeof HG_TAB_MODS !== 'undefined' && HG_TAB_MODS) ? HG_TAB_MODS : {};
      const mod = mods['brain'];
      if (!mod || typeof mod.mount !== 'function') return { ok: false, err: 'brain module not registered' };
      const pane = document.createElement('div');
      pane.style.display = 'none';
      document.body.appendChild(pane);
      mod.mount(pane);
      const runBtn = pane.querySelector('#brainRun');
      if (!runBtn) return { ok: false, err: 'brain pane incomplete: #brainRun' };
      runBtn.click();
      const t0 = Date.now();
      let stat = '';
      while (Date.now() - t0 < 360000) {
        await new Promise((r) => setTimeout(r, 4000));
        stat = (pane.querySelector('#brainStat') || {}).textContent || '';
        if (/^done|failed/i.test(stat)) break;
      }
      const snap = (typeof window.__hgBrainTicketNow === 'function') ? window.__hgBrainTicketNow() : null;
      /* engine-outage watchdog read: after a COMPLETED synthesis the gate
         engine must be publishing — null/stale here is the outage class
         that took the board down on 2026-07-25 */
      let engine = { live: false };
      try {
        const eng = (typeof window.engineState === 'function') ? window.engineState() : null;
        if (eng) engine = { live: true, survivors: Array.isArray(eng.survivors) ? eng.survivors.length : 0,
                            at: Number.isFinite(+eng.at) ? +eng.at : null };
      } catch (e) { engine = { live: false }; }
      /* sniper-grade hit set for the server-side high-priority push */
      let sniper = [];
      try {
        const sh = (typeof window.hgSniperState === 'function') ? window.hgSniperState() : [];
        if (Array.isArray(sh)) sniper = sh.filter(function(h){
          return h && h.sym && Number.isFinite(+h.entry) && Number.isFinite(+h.stop) && Number.isFinite(+h.t1);
        }).map(function(h){
          return { sym: String(h.sym), dir: String(h.dir || ''), entry: +h.entry, stop: +h.stop,
                   t1: +h.t1, lev: Number.isFinite(+h.lev) ? +h.lev : null, state: String(h.state || '') };
        });
      } catch (e) { sniper = []; }
      /* actionable squeeze set (fired / Donchian break) for the server-side
         push — published by squeeze.js's scan (sqWarm runs in this page) */
      let squeeze = [];
      try {
        const sq = window.HG_squeezeResults;
        const rows = (sq && Array.isArray(sq.results)) ? sq.results : [];
        squeeze = rows.filter(function(r){
          return r && r.sym && (r.dir === 'long' || r.dir === 'short')
            && (r.kind === 'fired' || r.kind === 'break');
        }).map(function(r){
          return { sym: String(r.sym), dir: String(r.dir), kind: String(r.kind || 'fired') };
        });
      } catch (e) { squeeze = []; }
      /* daily digest reads: the market-read line + up to 3 top planned rows
         from the completed synthesis (frozen snapshot, plan levels intact) */
      let read = '';
      try { read = (document.getElementById('brainRead') || {}).textContent || ''; } catch (e) {}
      let top = [];
      try {
        const last = (typeof window.__hgBrainLast === 'function') ? window.__hgBrainLast() : null;
        const rws = (last && Array.isArray(last.rows)) ? last.rows : [];
        top = rws.filter(function(r){
          return r && r.plan && isFinite(+r.plan.entry)
            && (r.tier === 'PRIME' || r.tier === 'HIGH' || r.tier === 'WATCH');
        }).slice(0, 3).map(function(r){
          return { sym: String(r.sym), dir: String(r.dir || ''), tier: String(r.tier || ''),
                   entry: +r.plan.entry, stop: +r.plan.stop, t1: +r.plan.t1 };
        });
      } catch (e) { top = []; }
      /* confirmed setups with levels — BRAIN PRIME/HIGH planned rows +
         EXECUTE survivors (6/6 gates) with plans. Entry/stop/t1 mandatory. */
      let setups = [];
      try {
        const pushSetup = function(src, sym, dir, p){
          if (!p) return;
          if (p.entry === null || p.entry === undefined || p.stop === null || p.stop === undefined
              || p.t1 === null || p.t1 === undefined) return;
          const e = +p.entry, st = +p.stop, t1 = +p.t1;
          if (!Number.isFinite(e) || !Number.isFinite(st) || !Number.isFinite(t1) || e === st) return;
          setups.push({ src: String(src), sym: String(sym), dir: String(dir || ''), entry: e, stop: st,
                        t1: t1, t2: Number.isFinite(+p.t2) ? +p.t2 : null });
        };
        (last && Array.isArray(last.rows) ? last.rows : []).forEach(function(r){
          if (r && r.plan && (r.tier === 'PRIME' || r.tier === 'HIGH'))
            pushSetup('BRAIN ' + r.tier, r.sym, r.dir, r.plan);
        });
        const engS = (typeof window.engineState === 'function') ? window.engineState() : null;
        (engS && Array.isArray(engS.survivors) ? engS.survivors : []).forEach(function(sv){
          if (sv && sv.plan) pushSetup('EXECUTE ' + String(sv.conviction || ''), sv.sym, sv.dir, sv.plan);
        });
      } catch (e) { setups = []; }
      /* news blackout read — USD high-impact events veto everything. The CI
         stamps this and pushes once when the window lifts (owner request
         2026-07-29: 'ping me when the blackout ends'). */
      let blackout = null;
      try {
        if (typeof window.hgNewsRisk === 'function'){
          const nr = window.hgNewsRisk('BTC');   /* USD events hit every symbol */
          blackout = { active: !!(nr && nr.blackout), note: String((nr && nr.note) || '').slice(0, 160) };
        }
      } catch (e) { blackout = null; }
      return { ok: /^done/i.test(stat), stat: String(stat).slice(0, 160), ticket: snap, engine: engine,
               sniper: sniper, squeeze: squeeze, setups: setups, read: String(read).slice(0, 300), top: top,
               blackout: blackout };
    } catch (e) {
      return { ok: false, err: (e && e.message) ? e.message : String(e) };
    }
  });

  await browser.close();

  const newState = result.state;
  console.log('New alert state:', JSON.stringify(newState));
  console.log('Email status (window.__hgLastEmail):', JSON.stringify(result.email));
  if (result.edge) {
    console.log('EDGE scan snapshot:', JSON.stringify(result.edge));
  }
  if (result.tabAlerts) {
    newState.tabAlerts = result.tabAlerts;
    console.log('Tab setup alert keys:', Object.keys(result.tabAlerts).length);
  } else if (prevState.tabAlerts) {
    newState.tabAlerts = prevState.tabAlerts;
  }

  const verdict = emailVerdict(result.email);
  if (verdict.warn) {
    console.warn('WARN: window.__hgLastEmail missing or malformed — no email attempted this cycle (or senders not instrumented yet); continuing.');
  }

  // keep-alive heartbeat (see HEARTBEAT_MS note above): stamp at most once/day,
  // otherwise preserve the committed stamp so the file stays byte-stable.
  if (needsHeartbeat(prevState, Date.now())) {
    newState.lastRunAt = new Date().toISOString();
  } else if (prevState.lastRunAt) {
    newState.lastRunAt = prevState.lastRunAt;
  }

  /* entry-ticket diff + server-side ntfy push. Seeds silently on the first
     recorded state; a failed synthesis leaves prevState.ticket untouched so
     a transient CI wobble never reads as 'ticket vanished'. */
  console.log('Ticket synthesis:', ticketResult.ok
    ? 'ok — ' + (ticketResult.stat || '')
    : 'degraded — ' + (ticketResult.err || ticketResult.stat || 'no detail'));
  if (ticketResult.ok && ticketResult.ticket) {
    const nextTicket = ticketSnapshot(ticketResult.ticket);
    console.log('Ticket now:', JSON.stringify(nextTicket), '· previous:', JSON.stringify(prevState.ticket ?? null));
    if (prevState.ticket === undefined) {
      console.log('Ticket state seeded silently (first recorded run) — no push.');
    } else if (ticketChanged(prevState.ticket, nextTicket)) {
      const pushResult = await sendAlertCi(offHoursPrefix() + 'HARDGATE entry ticket changed',
        ticketPushBody(nextTicket) + offHoursTag());
      console.log('TICKET CHANGED — push: ' + pushResult);
    } else {
      console.log('Ticket unchanged — no push.');
    }
    newState.ticket = nextTicket;
  } else if (prevState.ticket !== undefined) {
    newState.ticket = prevState.ticket;
  }

  /* sniper-grade push: the CI's highest-priority alert — a 20x-grade
     resting limit with the mark in/approaching the zone. Seeds silently;
     a changed non-empty set pushes; empty sets never push. */
  if (ticketResult.ok) {
    const hits = Array.isArray(ticketResult.sniper) ? ticketResult.sniper : [];
    const sKey = sniperKey(hits);
    console.log('Sniper-grade hits: ' + (hits.length ? hits.length + ' (' + sKey + ')' : 'none'));
    if (prevState.sniper === undefined) {
      console.log('Sniper state seeded silently — no push.');
      if (hits.length) newState.sniper = { key: sKey, hits: hits, at: new Date().toISOString() };
    } else if (hits.length && sKey !== (prevState.sniper && prevState.sniper.key)) {
      const pushResult = await sendAlertCi(offHoursPrefix() + '🎯 HARDGATE SNIPER SETUP',
        sniperBody(hits) + '\n20x-grade resting limit, mark in/approaching the zone.' + offHoursTag());
      console.log('SNIPER ALERT — push: ' + pushResult);
      newState.sniper = { key: sKey, hits: hits, at: new Date().toISOString() };
    } else if (prevState.sniper) {
      newState.sniper = hits.length ? { key: sKey, hits: hits, at: prevState.sniper.at } : prevState.sniper;
    }
  } else if (prevState.sniper !== undefined) {
    newState.sniper = prevState.sniper;   /* degraded run: keep, change nothing */
  }

  /* squeeze push: fired TTM squeezes + Donchian breaks across the perp
     universe. Same contract as sniper: seeds silently, a changed non-empty
     set pushes, empty sets never push; degraded runs keep the old state. */
  if (ticketResult.ok) {
    const sqRows = Array.isArray(ticketResult.squeeze) ? ticketResult.squeeze : [];
    const qKey = squeezeKey(sqRows);
    console.log('Squeeze setups: ' + (sqRows.length ? sqRows.length + ' (' + qKey + ')' : 'none'));
    if (prevState.squeeze === undefined) {
      console.log('Squeeze state seeded silently — no push.');
      if (sqRows.length) newState.squeeze = { key: qKey, rows: sqRows, at: new Date().toISOString() };
    } else if (sqRows.length && qKey !== (prevState.squeeze && prevState.squeeze.key)) {
      const pushResult = await sendAlertCi(offHoursPrefix() + '🌀 HARDGATE SQUEEZE',
        squeezeBody(sqRows) + offHoursTag());
      console.log('SQUEEZE ALERT — push: ' + pushResult);
      newState.squeeze = { key: qKey, rows: sqRows, at: new Date().toISOString() };
    } else if (prevState.squeeze) {
      newState.squeeze = sqRows.length ? { key: qKey, rows: sqRows, at: prevState.squeeze.at } : prevState.squeeze;
    }
  } else if (prevState.squeeze !== undefined) {
    newState.squeeze = prevState.squeeze;   /* degraded run: keep, change nothing */
  }

  /* news-blackout transition push: ACTIVE→clear pings once so the owner knows
     setups can form again; clear→ACTIVE pings once so a quiet board is
     explained before anyone asks. Seeds silently; degraded runs keep state. */
  if (ticketResult.ok && ticketResult.blackout) {
    const cur = !!ticketResult.blackout.active;
    const note = String(ticketResult.blackout.note || '');
    console.log('News blackout: ' + (cur ? 'ACTIVE — ' + note : 'clear'));
    if (prevState.newsBlackout === undefined) {
      newState.newsBlackout = { active: cur, at: new Date().toISOString() };
      console.log('Blackout state seeded silently — no push.');
    } else {
      const was = !!(prevState.newsBlackout && prevState.newsBlackout.active);
      if (was && !cur) {
        const pushResult = await sendAlertCi('✅ HARDGATE NEWS BLACKOUT LIFTED',
          'The high-impact event window has passed — majors are tradeable again.'
          + '\nNew confirmed setups resume pushing here with entry/SL/TP/lev.');
        console.log('BLACKOUT LIFTED — push: ' + pushResult);
      } else if (!was && cur) {
        const pushResult = await sendAlertCi('⛔ HARDGATE NEWS BLACKOUT',
          (note || 'High-impact event risk active') + '\nMajors are vetoed until the window passes — a quiet board is expected, not broken.');
        console.log('BLACKOUT STARTED — push: ' + pushResult);
      }
      newState.newsBlackout = { active: cur, at: new Date().toISOString() };
    }
  } else if (prevState.newsBlackout !== undefined) {
    newState.newsBlackout = prevState.newsBlackout;   /* degraded run: keep, change nothing */
  }

  /* confirmed-setups sweep: every run, NEW valid+confirmed setups with
     entry/SL/TP from BRAIN PRIME/HIGH + EXECUTE survivors push once per 24h
     per sym:dir@entry. Seeds silently; degraded runs keep the old memory. */
  if (ticketResult.ok) {
    const merged = mergeSetups(ticketResult.setups);
    const prevKeys = (prevState.setups && prevState.setups.keys) || {};
    const { fresh, keys } = freshSetups(prevKeys, merged, Date.now());
    console.log('Confirmed setups: ' + merged.length + ' live · ' + fresh.length + ' new');
    if (prevState.setups === undefined) {
      console.log('Setups memory seeded silently (' + Object.keys(keys).length + ' keys) — no push.');
    } else if (fresh.length) {
      const pushResult = await sendAlertCi(offHoursPrefix() + '📋 HARDGATE CONFIRMED SETUP' + (fresh.length > 1 ? 'S' : ''),
        setupsBody(fresh) + offHoursTag());
      console.log('CONFIRMED SETUPS — push: ' + pushResult);
    }
    newState.setups = { keys: keys, at: new Date().toISOString() };
  } else if (prevState.setups !== undefined) {
    newState.setups = prevState.setups;   /* degraded run: keep, change nothing */
  }

  /* engine-outage watchdog: verdict over the post-synthesis engine read;
     one push per ENGINE_ALERT_MS per continuous outage, stamp carried in
     alert-state.json; recovery clears it honestly. */
  if (ticketResult.ok) {
    const engV = engineVerdict(ticketResult.engine, Date.now());
    if (engV.ok) {
      console.log('Engine live — ' + engV.survivors + ' survivors voting.'
        + (prevState.engineAlertAt ? ' (recovered — outage stamp cleared)' : ''));
    } else {
      console.warn('ENGINE DARK: ' + engV.why);
      if (engineAlertDue(prevState.engineAlertAt, Date.now())) {
        const pushResult = await sendAlertCi('HARDGATE engine layer dark',
          engV.why + ' — 500+ contracts lost their structural voter. Open the EXECUTE tab / check the scan.');
        console.warn('ENGINE DARK — push: ' + pushResult);
        newState.engineAlertAt = new Date().toISOString();
      } else {
        console.warn('ENGINE DARK — inside the 2h throttle, no push.');
        if (prevState.engineAlertAt) newState.engineAlertAt = prevState.engineAlertAt;
      }
    }
  } else if (prevState.engineAlertAt) {
    newState.engineAlertAt = prevState.engineAlertAt;   /* degraded run: keep the stamp, change nothing */
  }

  /* DAILY DIGEST — one full-market summary per day at ~21:07 IST, riding
     the 15-min runs. Unconditional channel (a daily, never throttled); the
     stamp rides alert-state.json so exactly one digest per day. */
  if (ticketResult.ok && digestDue(prevState.digestAt, Date.now())) {
    /* timed probe of the site root — the hosting-health line in the digest */
    let hosting = null;
    try{
      const t0 = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const resp = await fetch(SITE_URL, { signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(timer);
      hosting = { ok: resp.ok, status: resp.status, ms: Date.now() - t0 };
    }catch(e){
      hosting = { ok: false, status: 0, ms: 0, err: (e && e.name === 'AbortError') ? 'timeout >20s' : String((e && e.message) || e).slice(0, 80) };
    }
    const body = digestBody({
      now: Date.now(),
      read: ticketResult.read || '',
      ticket: ticketSnapshot(ticketResult.ticket),
      prevTicket: prevState.digestTicket || null,
      sniper: Array.isArray(ticketResult.sniper) ? ticketResult.sniper : [],
      engineOk: engineVerdict(ticketResult.engine, Date.now()).ok,
      survivors: engineVerdict(ticketResult.engine, Date.now()).survivors || 0,
      top: Array.isArray(ticketResult.top) ? ticketResult.top : [],
      hosting: hosting
    });
    const pushResult = await sendAlertCi('HARDGATE DAILY DIGEST', body);
    console.log('DAILY DIGEST — push: ' + pushResult);
    newState.digestAt = new Date().toISOString();
    newState.digestTicket = ticketSnapshot(ticketResult.ticket);
  } else if (prevState.digestAt) {
    newState.digestAt = prevState.digestAt;
    if (prevState.digestTicket) newState.digestTicket = prevState.digestTicket;
  }

  /* email gate LAST: the ticket + engine bookkeeping above is saved either
     way. On email failure the alert KEYS roll back (the setup re-fires and
     the email retries next run) — without discarding ticket/engine state
     the way the old early-exit did (found in the 2026-07-25 run logs).
     Before going red, the SAME new setup goes out via the free ntfy
     fallback — once per setup per leg; when every new setup is covered the
     run stays GREEN with a loud warn (the alert reached the owner; the
     email channel's failure is a degradation, not a lost alert). */
  if (verdict.fail) {
    const need = fallbackLegs(prevState, result.state);
    const prevFb = (prevState && typeof prevState.ntfyFallback === 'object' && prevState.ntfyFallback) || {};
    const fb = Object.assign({}, prevFb);
    let covered = 0;
    for (const item of need) {
      const label = item.leg.toUpperCase() + ' setup: ' + JSON.stringify(item.key);
      const pushResult = await sendAlertCi('HARDGATE ' + label,
        'New ' + item.leg + ' setup ' + JSON.stringify(item.key)
          + ' — the email channel failed (' + verdict.err
          + '); this ntfy is the free fallback. Levels: open the site.');
      console.log('ntfy fallback ' + item.leg + ' ' + JSON.stringify(item.key) + ': ' + pushResult);
      /* only a real 'sent' covers the alert — 'skipped: no NTFY_TOPIC'
         means the alert went NOWHERE; the run must go red and say so,
         never green on a silent loss */
      if (pushResult.indexOf('sent') >= 0){
        fb[item.leg] = { key: item.key, at: new Date().toISOString() };
        covered++;
      }
    }
    if (Object.keys(fb).length) newState.ntfyFallback = fb;
    newState.delta = prevState.delta ?? null;
    newState.coindcx = prevState.coindcx ?? null;
    newState.gold = prevState.gold ?? null;
    saveState(newState);
    if (covered === need.length) {
      console.warn('EMAIL DELIVERY FAILED (' + verdict.err + ') but every new setup (' + need.length
        + ') went out via the ntfy fallback — staying GREEN; the email channel retries next run.');
      return;
    }
    console.error('EMAIL DELIVERY FAILED: ' + verdict.err + ' — and ' + (need.length - covered)
      + ' setup(s) could not be delivered by the fallback either — alert keys rolled back, the run is red, retry next run.');
    process.exit(1);
  }

  saveState(newState);

  const alertChanged = ['delta', 'coindcx', 'gold'].some(
    (k) => JSON.stringify(prevState[k]) !== JSON.stringify(newState[k])
  );
  console.log(
    alertChanged
      ? 'State changed for at least one exchange - a new-setup email should have been sent via EmailJS (check inbox / spam).'
      : 'No change since last cycle - no new email expected (either still WAIT, or same setup as last alert).'
  );
  if (newState.lastRunAt && newState.lastRunAt !== prevState.lastRunAt) {
    console.log('Keep-alive heartbeat stamped lastRunAt=' + newState.lastRunAt + ' (~1 commit/day; defends against GitHub\'s 60-day scheduled-workflow auto-disable).');
  }
}

// only run when invoked directly (`node scripts/alert-check.mjs`), not when imported by tests
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}

export { needsHeartbeat, emailVerdict, HEARTBEAT_MS,
         ticketSnapshot, ticketChanged, ticketPushBody, sendTicketPush, sendNtfy,
         sendTelegramCi, sendAlertCi,
         engineVerdict, engineAlertDue, ENGINE_STALE_MS, ENGINE_ALERT_MS,
         fallbackLegs, sniperKey, sniperBody, squeezeKey, squeezeBody,
         mergeSetups, setupKey, freshSetups, setupsBody, SETUP_REMIND_MS,
         digestDue, digestBody, ticketLine, DIGEST_HOUR_UTC, DIGEST_MIN_UTC,
         istOffHours, offHoursPrefix, offHoursTag };
