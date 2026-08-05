/* =========================================================================
HARDGATE — hgalert.js
SOUND ALERTS: a small fixed-position bell (bottom-right, NOT a tab) that
plays a short synthesized musical phrase so the owner knows to come enter:

  (a) BRAIN — window.__hgBrainLast() rows contain tier HIGH or PRIME.
      Alerts once per NEW sym+tier set: the last-alerted set is tracked and
      a re-alert fires only when the set changes or 30 min have passed. A
      set that goes dark (no HIGH/PRIME rows) re-arms — its return is new.
  (b) GOLD — combined live qualifying candidates from window.goldscalpScan()
      and window.goldswingScan() (.cands arrays, read defensively) reaching
      the threshold (default 10, user-editable in the bell panel, persisted
      'hgAlertGoldMin'). Alerts once per UPWARD crossing; re-arms when the
      count falls back below the threshold. Absent/throwing sources count 0
      and are named in the panel — never an error.
  (c) TICKET — the BRAIN tab's ENTRY TICKET, pushed by brain.js on every
      completed synthesis via window.hgAlertTicket({at, long, short}).
      Alerts once per CHANGED ticket: the key is sym@entry per side, so a
      new symbol OR a moved entry price on either side fires. The first
      sighting after load seeds silently; 'no qualified entry' is a real
      state — a side appearing or vanishing IS a change. When armed, the
      chime fires AND an ntfy push goes out via window.sendAlertPush (when
      a topic is configured); the 15-min class throttle covers both.
  (d) SNIPER — the highest-priority alert: 20x-grade resting limits with
      the mark IN ZONE or APPROACHING, pushed by brain.js after every
      paint via window.hgAlertSniper(hits). New card or moved entry fires
      chime + Telegram-first push cascade (ntfy at priority 5 second).

SOUND: Web Audio API synthesized chime (no audio file) — E5 -> G5 -> C6
(659.26 / 783.99 / 1046.50 Hz, sine/sine/triangle, ~0.9s, soft exponential
envelopes, modest master gain). AudioContext is feature-checked; when the
browser has none the bell honestly shows 'sound unavailable in this
browser'.

AUTOPLAY POLICY (honest): browsers block audio before a user gesture. The
bell starts in 'click to enable alerts'; the first click creates/resumes
the AudioContext, plays a test chime and arms the engine. Enabled state
persists in localStorage 'hgAlertEnabled'; on later loads a previously-
enabled bell shows 'armed — plays after your next click' until a gesture
unlocks it — it never pretends it can play before one.

THROTTLE: minimum 15 min between chimes of the same class ('brain' /
'gold') even if conditions persist; the classes chime independently. A
trigger consumed by the throttle or by MUTE is acknowledged in the last-
alert line ('chime held by 15-min throttle' / 'muted') — never silent
about having fired.

UI: bell button states off / click-to-enable / armed / muted, plus a small
expand panel — master MUTE toggle (persisted 'hgAlertMuted'), gold
threshold input, last-alert lines ('13:41 brain HIGH: RE, ZBT' /
'13:52 gold setups 11 >= 10'), a TEST CHIME button, and the honest note
'alerts evaluate while the app is open, after scans have run — brain
alerts need a completed synthesis'.

EVALUATION: every 60s (single guarded setInterval, unref'd) plus the
manual window.hgAlertCheck(). Every getter call is wrapped in try/catch;
absent window.__hgBrainLast etc. is a normal state, never an error.

TEST/DIAGNOSTIC SURFACE (never throws):
  window.hgAlertCheck() -> one evaluation round; returns a plain status
    object {enabled, unlocked, muted, audioOk, goldMin, chimed[], note,
    brain?, gold?}.
  window.hgAlertTest()  -> plays the test chime now (bypasses MUTE — it is
    a sound check, not an alert); returns true when the chime played.

Classic script, no build step, loads after the modules it reads; absence
of any module, DOM, storage or AudioContext degrades honestly. Never
throws at load, at evaluation, or at chime time.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined') ? globalThis : {};

var LS_ENABLED = 'hgAlertEnabled';
var LS_MUTED   = 'hgAlertMuted';
var LS_GOLDMIN = 'hgAlertGoldMin';

var INTERVAL_MS       = 60*1000;         /* evaluation cadence */
var CHIME_GAP_MS      = 15*60*1000;      /* per-class chime throttle */
var BRAIN_REALERT_MS  = 30*60*1000;      /* same-set brain re-alert */
var GOLD_MIN_DEFAULT  = 10;

/* ---------------- tiny helpers ---------------- */
function esc(s){
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function gfn(name){
  try{ if (typeof W[name] === 'function') return W[name]; }catch(e){}
  try{ if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function') return globalThis[name]; }catch(e){}
  return null;
}
function alertFmtPx(n){
  var x = +n;
  if (!(typeof x === 'number' && isFinite(x))) return '—';
  var a = Math.abs(x);
  var d = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 6 : 8;
  try{ return Number(x).toLocaleString('en-US', { maximumFractionDigits: d }); }catch(e){ return String(x); }
}
/** COIN / ENTRY / STOP LOSS / TAKE PROFIT — shared by sniper + squeeze Telegram pushes. */
function alertPlanBlock(sym, dir, entry, stop, t1, t2){
  var ext = gfn('hgTelegramPlanBlock');
  if (ext){
    try{ return ext({ sym: sym, dir: dir, entry: entry, stop: stop, t1: t1, t2: t2 }); }catch(e){}
  }
  var lines = [
    'COIN: ' + String(sym || '—'),
    'SIDE: ' + String(dir || '—').toUpperCase(),
    'ENTRY: ' + alertFmtPx(entry),
    'STOP LOSS: ' + alertFmtPx(stop),
    'TAKE PROFIT 1: ' + alertFmtPx(t1)
  ];
  if (t2 !== null && t2 !== undefined && isFinite(+t2)) lines.push('TAKE PROFIT 2: ' + alertFmtPx(t2));
  return lines.join('\n');
}
function sniperTelegramBlocks(hits){
  var blocks = [];
  for (var i = 0; i < hits.length && blocks.length < 5; i++){
    var h = hits[i];
    if (!h || !h.sym) continue;
    var head = String(h.sym) + ' ' + String(h.dir || '').toUpperCase()
      + ' (' + (h.lev || '?') + 'x, ' + (h.state || '?') + ')';
    blocks.push(head + '\n' + alertPlanBlock(h.sym, h.dir, h.entry, h.stop, h.t1, null));
  }
  if (hits.length > 5) blocks.push('+' + (hits.length - 5) + ' more on the BRAIN sniper board');
  return blocks.length ? blocks.join('\n\n') : '—';
}
function squeezeTelegramBlocks(hits){
  var blocks = [];
  for (var i = 0; i < hits.length && blocks.length < 5; i++){
    var h = hits[i];
    if (!h || !h.sym) continue;
    var head = String(h.sym) + ' ' + String(h.dir || '').toUpperCase()
      + ' (' + (h.kind === 'break' ? 'DONCHIAN BREAK' : 'FIRED') + ')';
    var e = (h.entry === null || h.entry === undefined) ? NaN : +h.entry;
    blocks.push(isFinite(e)
      ? head + '\n' + alertPlanBlock(h.sym, h.dir, h.entry, h.stop, h.t1, null)
      : head + '\nCOIN: ' + h.sym + '\nSIDE: ' + String(h.dir || '').toUpperCase()
        + '\nENTRY / STOP LOSS / TAKE PROFIT: see levels on the SQUEEZE tab');
  }
  if (hits.length > 5) blocks.push('+' + (hits.length - 5) + ' more on the SQUEEZE tab');
  return blocks.length ? blocks.join('\n\n') : '—';
}
/* OFF-HOURS tag for ticket/sniper pushes — same windows as brain.js
   sessionWindow (Sunday, or 01:00-06:30 IST). Prefers the brain's own seam
   (__hgBrainSession) so app and alerts never disagree; falls back to the same
   IST math standalone. Alerts are TAGGED, never suppressed — the brain
   already haircut the conviction. Never throws. */
function offHoursTag(){
  try{
    var sw = gfn('__hgBrainSession');
    var dead = null;
    if (sw){ var w = sw(); if (w && typeof w.dead === 'boolean') dead = w.dead; }
    if (dead === null){
      var d = new Date();
      var ist = new Date(d.getTime() + (330 + d.getTimezoneOffset()) * 60000);
      var mins = ist.getHours() * 60 + ist.getMinutes();
      dead = (ist.getDay() === 0) || (mins >= 60 && mins <= 390);
    }
    return dead ? '\n⚠️ OFF-HOURS tape (Sun / 01:00-06:30 IST) — conviction haircut applied; half size or skip' : '';
  }catch(e){ return ''; }
}
function rowsFrom(val){
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object'){
    var keys = ['rows', 'cands', 'results', 'cards', 'setups'];
    for (var i = 0; i < keys.length; i++){
      if (Array.isArray(val[keys[i]])) return val[keys[i]];
    }
  }
  return [];
}
function hhmm(){
  try{
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }catch(e){ return ''; }
}

/* ---------------- storage (soft probes, never throw) ---------------- */
function lsGet(k){
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    return localStorage.getItem(k);
  }catch(e){ return null; }
}
function lsSet(k, v){
  try{
    if (typeof localStorage === 'undefined' || !localStorage) return;
    localStorage.setItem(k, v);
  }catch(e){}
}

/* ---------------- state ---------------- */
var __enabled  = (lsGet(LS_ENABLED) === '1');
var __muted    = (lsGet(LS_MUTED) === '1');
var __goldMin  = (function(){
  var n = parseInt(lsGet(LS_GOLDMIN), 10);
  return (isFinite(n) && n >= 1 && n <= 99) ? n : GOLD_MIN_DEFAULT;
})();
var __unlocked = false;                  /* session-only: a gesture has unlocked audio */
var __ctx      = null;                   /* AudioContext, created on first gesture */
var __timer    = null;                   /* setInterval handle — started once, guarded */
var __ui       = null;                   /* bell DOM, null when headless */
var __panelOpen = false;

var __lastChime = { brain: 0, gold: 0, ticket: 0, sniper: 0 }; /* per-class throttle clocks */
var __lastBrainKey = null;               /* last-alerted sym+tier set (null = armed) */
var __lastBrainTrigAt = 0;               /* last brain trigger (chimed or consumed) */
var __goldArmed = true;                  /* gold crossing latch (re-arms below threshold) */
var __lastBrainLine = '';                /* '13:41 brain HIGH: RE, ZBT' */
var __lastGoldLine  = '';                /* '13:52 gold setups 11 >= 10' */
var __ticketKey = null;                  /* last-seen ticket key (null = not seeded yet) */
var __ticketDesc = '';                   /* 'long BTC@112000 · short —' */
var __ticketLive = false;                /* a ticket push has arrived this session */
var __lastTicketLine = '';               /* '00:21 ticket: short ACE@0.0852 → ACE@0.0853' */
var __sniperKey = null;                  /* last-seen sniper hit-set key */
var __sniperDesc = '';                   /* 'ACE SHORT @ 0.0852 (24x, IN ZONE) · …' */
var __sniperLive = false;                /* a sniper push has arrived this session */
var __lastSniperLine = '';               /* last sniper alert/seed line */
var __squeezeKey = null;                 /* last-seen squeeze hit-set key */
var __lastSqueezeLine = '';              /* last squeeze alert/seed line (push-only class) */

/* last evaluation reads, for the panel's honest lines */
var __evaluated = false;
var __brainLive = false, __brainHits = [];
var __gold = { count: 0, scalp: 0, swing: 0, scalpLive: false, swingLive: false };

/* ---------------- audio engine ---------------- */
function acCtor(){
  try{ if (typeof W.AudioContext === 'function') return W.AudioContext; }catch(e){}
  try{ if (typeof W.webkitAudioContext === 'function') return W.webkitAudioContext; }catch(e){}
  return null;
}
function audioOk(){ return !!acCtor(); }

function ensureCtx(){
  var AC = acCtor();
  if (!AC) return null;
  try{
    if (!__ctx) __ctx = new AC();
    if (__ctx && __ctx.state === 'suspended' && typeof __ctx.resume === 'function'){
      try{
        var p = __ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(function(){});
      }catch(e){}
    }
    return __ctx;
  }catch(e){ return null; }
}

/* the click that reaches unlockAudio() IS the user gesture */
function unlockAudio(){
  if (__unlocked) return true;
  var ctx = ensureCtx();
  if (!ctx) return false;
  __unlocked = true;
  return true;
}

/* E5 -> G5 -> C6, ~0.9s, soft exponential envelopes, modest master gain.
   Raw player: no enable/mute/throttle gating here — callers gate. */
function playChime(){
  try{
    var ctx = ensureCtx();
    if (!ctx) return false;
    if (typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') return false;
    var dest = ctx.destination;
    if (!dest) return false;
    var t0 = 0;
    try{ if (typeof ctx.currentTime === 'number' && isFinite(ctx.currentTime)) t0 = ctx.currentTime; }catch(e){}
    var master = ctx.createGain();
    if (!master) return false;
    try{
      if (master.gain && typeof master.gain.setValueAtTime === 'function') master.gain.setValueAtTime(0.6, t0);
      else if (master.gain) master.gain.value = 0.6;
    }catch(e){}
    try{ master.connect(dest); }catch(e){ return false; }
    var notes = [659.26, 783.99, 1046.50];   /* E5, G5, C6 */
    var types = ['sine', 'sine', 'triangle'];
    var step = 0.18, hold = 0.55;            /* last note rings out ~0.9s total */
    for (var i = 0; i < notes.length; i++){
      var t = t0 + i*step;
      var osc = null, g = null;
      try{ osc = ctx.createOscillator(); g = ctx.createGain(); }catch(e){ continue; }
      if (!osc || !g) continue;
      try{ osc.type = types[i]; }catch(e){}
      try{
        if (osc.frequency && typeof osc.frequency.setValueAtTime === 'function') osc.frequency.setValueAtTime(notes[i], t);
        else if (osc.frequency) osc.frequency.value = notes[i];
      }catch(e){}
      try{
        var gn = g.gain;
        if (gn && typeof gn.setValueAtTime === 'function'){
          gn.setValueAtTime(0.0001, t);
          if (typeof gn.exponentialRampToValueAtTime === 'function'){
            gn.exponentialRampToValueAtTime(0.25, t + 0.02);
            gn.exponentialRampToValueAtTime(0.0001, t + hold);
          }
        } else if (gn){ gn.value = 0.2; }
      }catch(e){}
      try{ osc.connect(g); }catch(e){ continue; }
      try{ g.connect(master); }catch(e){}
      try{ if (typeof osc.start === 'function') osc.start(t); }catch(e){}
      try{ if (typeof osc.stop === 'function') osc.stop(t + hold + 0.05); }catch(e){}
    }
    return true;
  }catch(e){ return false; }
}

/* per-class chime gate: MUTE suppresses evaluation chimes (TEST bypasses —
   it calls playChime directly); 15 min minimum between same-class chimes. */
function tryChime(cls){
  if (__muted) return 'muted';
  var now = 0;
  try{ now = Date.now(); }catch(e){ return 'silent'; }
  if (now - (__lastChime[cls] || 0) < CHIME_GAP_MS) return 'throttled';
  if (!playChime()) return 'silent';
  __lastChime[cls] = now;
  return 'played';
}

/* ---------------- source readers (each catch-isolated) ---------------- */
/* brain: window.__hgBrainLast() -> {rows:[{sym, tier, ...}]}. Qualifying =
   tier HIGH or PRIME. live=false when absent/throwing/null — normal state. */
function brainQual(){
  var fn = null;
  try{ if (typeof W.__hgBrainLast === 'function') fn = W.__hgBrainLast; }catch(e){}
  if (!fn) return { live: false, hits: [] };
  var val = null;
  try{ val = fn(); }catch(e){ return { live: false, hits: [] }; }
  if (val === null || val === undefined) return { live: false, hits: [] };
  var rows = rowsFrom(val), hits = [], seen = {};
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r || typeof r !== 'object') continue;
    var tier = String(r.tier === null || r.tier === undefined ? '' : r.tier).toUpperCase();
    if (tier !== 'HIGH' && tier !== 'PRIME') continue;
    var sym = r.sym || r.symbol;
    if (!sym) continue;
    sym = String(sym);
    var k = sym + '|' + tier;
    if (seen[k]) continue;
    seen[k] = 1;
    hits.push({ sym: sym, tier: tier });
  }
  return { live: true, hits: hits };
}
function brainKey(hits){
  var parts = [];
  for (var i = 0; i < hits.length; i++) parts.push(hits[i].sym + '|' + hits[i].tier);
  parts.sort();
  return parts.join(';');
}
function brainTopTier(hits){
  for (var i = 0; i < hits.length; i++) if (hits[i].tier === 'PRIME') return 'PRIME';
  return 'HIGH';
}
function brainSyms(hits){
  var out = [], seen = {};
  for (var i = 0; i < hits.length; i++){
    if (seen[hits[i].sym]) continue;
    seen[hits[i].sym] = 1;
    out.push(hits[i].sym);
  }
  if (out.length > 6) return out.slice(0, 6).join(', ') + ' +' + (out.length - 6) + ' more';
  return out.join(', ');
}

/* gold: window.goldscalpScan() / window.goldswingScan() -> {cands:[...]}.
   Combined qualifying count; absent/throwing sources count 0 and are named. */
function goldCount(){
  var out = { count: 0, scalp: 0, swing: 0, scalpLive: false, swingLive: false };
  var srcs = [['scalp', 'goldscalpScan'], ['swing', 'goldswingScan']];
  for (var s = 0; s < srcs.length; s++){
    var fn = gfn(srcs[s][1]);
    if (!fn) continue;
    var val = null;
    try{ val = fn(); }catch(e){ continue; }
    if (val === null || val === undefined) continue;
    var cands = Array.isArray(val) ? val
              : (val && typeof val === 'object' && Array.isArray(val.cands)) ? val.cands : [];
    var n = 0;
    for (var i = 0; i < cands.length; i++) if (cands[i] && typeof cands[i] === 'object') n++;
    out[srcs[s][0]] = n;
    out[srcs[s][0] + 'Live'] = true;
    out.count += n;
  }
  return out;
}

/* ---------------- (c) TICKET — entry-ticket change alerts ----------------
   brain.js pushes {at, long:{sym,entry}|null, short:{sym,entry}|null} on
   every completed synthesis. The alert key is sym@entry per side — a new
   symbol, a moved entry, or a side appearing/vanishing all count as a
   change. First sighting seeds silently. Chime + ntfy share the class
   throttle. Never throws. */
function ticketSideKey(side){
  if (!side || !side.sym || !isFinite(+side.entry)) return '—';
  return String(side.sym) + '@' + String(+side.entry);
}
function ticketKeyOf(snap){
  return ticketSideKey(snap && snap.long) + ';' + ticketSideKey(snap && snap.short);
}
function ticketDescOf(snap){
  var L = (snap && snap.long && snap.long.sym) ? ('long ' + snap.long.sym + '@' + (+snap.long.entry)) : 'long —';
  var S = (snap && snap.short && snap.short.sym) ? ('short ' + snap.short.sym + '@' + (+snap.short.entry)) : 'short —';
  return L + ' · ' + S;
}
function onTicket(snap){
  try{
    if (!snap || typeof snap !== 'object') return 'ignored';
    var key = ticketKeyOf(snap);
    __ticketLive = true;
    __ticketDesc = ticketDescOf(snap);
    if (__ticketKey === null){ __ticketKey = key; renderUI(); return 'seeded'; }
    if (key === __ticketKey) return 'unchanged';
    __ticketKey = key;
    var line = hhmm() + ' ticket: ' + __ticketDesc;
    if (!__enabled || !__unlocked || !audioOk()){
      __lastTicketLine = line + (__enabled ? ' (armed — plays after your next click)' : ' (alerts off)');
      renderUI();
      return 'unarmed';
    }
    var now = 0;
    try{ now = Date.now(); }catch(e){ now = 0; }
    if (now - (__lastChime.ticket || 0) < CHIME_GAP_MS){
      __lastTicketLine = line + ' (alert held by 15-min throttle)';
      renderUI();
      return 'throttled';
    }
    __lastChime.ticket = now;
    var suffix;
    if (__muted){ suffix = ' (muted)'; }
    else if (playChime()){ suffix = ''; }
    else { suffix = ' (sound failed)'; }
    /* push cascade: Telegram first (index.html sendTelegram), ntfy second —
       the 2026-07-27 gap: ticket changes chimed but never reached Telegram
       when only ntfy was wired. Fire-and-forget; results never block. */
    var tickTxt = 'HARDGATE entry ticket changed\n'
      + 'Tab: hgalert (entry ticket board)\n'
      + 'Signal: #1 long/short ticket pair changed on the live board\n'
      + 'Long: ' + ((snap.long && snap.long.sym) ? snap.long.sym + ' @ ' + (+snap.long.entry) : '—')
      + '\nShort: ' + ((snap.short && snap.short.sym) ? snap.short.sym + ' @ ' + (+snap.short.entry) : '—')
      + offHoursTag()
      + '\nhttps://hardgate-main.onrender.com/';
    try{
      var tg = gfn('sendTelegram');
      if (tg){
        suffix += ' · telegram';
        Promise.resolve(tg(tickTxt)).then(function(r){
          if (r !== true){ var nt = gfn('sendAlertPush'); if (nt) nt('HARDGATE entry ticket changed', tickTxt); }
        }).catch(function(){ var nt = gfn('sendAlertPush'); if (nt) nt('HARDGATE entry ticket changed', tickTxt); });
      }else{
        var nt2 = gfn('sendAlertPush');
        if (nt2){ nt2('HARDGATE entry ticket changed', tickTxt); suffix += ' · ntfy'; }
      }
    }catch(e){ suffix += ' · push failed'; }
    __lastTicketLine = line + suffix;
    renderUI();
    return 'alerted';
  }catch(e){ return 'error'; }
}

/* ---------------- (d) SNIPER — 20x-grade in-zone entries, the owner's
   highest-priority alert. brain.js pushes the hit set after every paint:
   [{sym, dir, entry, stop, t1, lev, state}]. Alert on a CHANGED set (new
   card, moved entry, card vanished is noted silently); first sighting
   seeds silently. Push cascade: Telegram first (sendTelegram, index.html),
   ntfy second (sendAlertPush at priority 5). 15-min class throttle covers
   both. Never throws. */
function sniperKeyOf(hits){
  var parts = [];
  for (var i = 0; i < hits.length; i++){
    var h = hits[i];
    if (h && h.sym && isFinite(+h.entry)) parts.push(String(h.sym) + '@' + String(+h.entry));
  }
  parts.sort();
  return parts.join(';');
}
function sniperDesc(hits){
  var bits = [];
  for (var i = 0; i < hits.length && bits.length < 3; i++){
    var h = hits[i];
    if (h && h.sym) bits.push(String(h.sym) + ' ' + String(h.dir || '').toUpperCase()
      + ' @ ' + (+h.entry) + ' (' + (h.lev || '?') + 'x, ' + (h.state || '?') + ')'
      + ' · SL ' + (+h.stop) + ' · TP ' + (+h.t1));
  }
  return bits.length ? bits.join(' · ') + (hits.length > 3 ? ' +' + (hits.length - 3) + ' more' : '') : '—';
}
function onSniper(hits){
  try{
    if (!Array.isArray(hits)) return 'ignored';
    var key = sniperKeyOf(hits);
    __sniperLive = true;
    if (__sniperKey === null){ __sniperKey = key; __sniperDesc = sniperDesc(hits); renderUI(); return 'seeded'; }
    if (key === __sniperKey) return 'unchanged';
    __sniperKey = key;
    __sniperDesc = sniperDesc(hits);
    if (!hits.length){ __lastSniperLine = hhmm() + ' sniper board cleared'; renderUI(); return 'cleared'; }
    var line = hhmm() + ' SNIPER: ' + __sniperDesc;
    if (!__enabled || !__unlocked || !audioOk()){
      __lastSniperLine = line + (__enabled ? ' (armed — plays after your next click)' : ' (alerts off)');
      renderUI();
      return 'unarmed';
    }
    var now = 0;
    try{ now = Date.now(); }catch(e){ now = 0; }
    if (now - (__lastChime.sniper || 0) < CHIME_GAP_MS){
      __lastSniperLine = line + ' (alert held by 15-min throttle)';
      renderUI();
      return 'throttled';
    }
    __lastChime.sniper = now;
    var suffix;
    if (__muted){ suffix = ' (muted)'; }
    else if (playChime()){ suffix = ''; }
    else { suffix = ' (sound failed)'; }
    /* push cascade: Telegram first (index.html sendTelegram), ntfy at max
       priority second — fire-and-forget both ways, results never block.
       Validity named so the owner knows the window (limits work ~24h or
       until structure breaks — same contract as the plan itself). */
    var validUntil = '';
    try{
      var vu = new Date(now + 24 * 3600 * 1000);
      validUntil = '\nvalid until ~' + ('0' + vu.getHours()).slice(-2) + ':' + ('0' + vu.getMinutes()).slice(-2)
        + ' tomorrow (24h limit validity, or until structure breaks)';
    }catch(e){}
    var txt = '🎯 HARDGATE SNIPER SETUP\n'
      + 'Tab: BRAIN tab (sniper board)\n'
      + 'Signal: 20x-grade resting limit in/approaching zone\n'
      + sniperTelegramBlocks(hits)
      + '\n20x-grade resting limit, mark in/approaching the zone.' + validUntil
      + offHoursTag()
      + '\nhttps://hardgate-main.onrender.com/';
    try{
      var tg = gfn('sendTelegram');
      if (tg){ suffix += ' · telegram'; Promise.resolve(tg(txt)).then(function(r){
        if (r !== true){ var nt = gfn('sendAlertPush'); if (nt) nt('HARDGATE SNIPER SETUP', txt, { priority: 5 }); }
      }).catch(function(){ var nt = gfn('sendAlertPush'); if (nt) nt('HARDGATE SNIPER SETUP', txt, { priority: 5 }); }); }
      else { var nt2 = gfn('sendAlertPush'); if (nt2){ nt2('HARDGATE SNIPER SETUP', txt, { priority: 5 }); suffix += ' · ntfy p5'; } }
    }catch(e){}
    __lastSniperLine = line + suffix;
    renderUI();
    return 'alerted';
  }catch(e){ return 'error'; }
}

/* ---------------- (d2) SQUEEZE — fired TTM squeezes + Donchian breaks,
   pushed by squeeze.js's publishSqueezeState after every scan (mounted or
   sqWarm): [{sym, dir, kind:'fired'|'break', entry, stop, t1}] — levels are
   null when the publisher had no candles (sqWarm path); the message then
   honestly points at the SQUEEZE tab. Same semantics as SNIPER: first
   sighting seeds silently, a changed NON-EMPTY set chimes + pushes
   (Telegram first, ntfy p4 second), an empty set clears silently, 15-min
   class throttle. Push-only class: no panel row. Never throws. */
function squeezeKeyOf(hits){
  var parts = [];
  for (var i = 0; i < hits.length; i++){
    var h = hits[i];
    if (h && h.sym && (h.dir === 'long' || h.dir === 'short')){
      var e = (h.entry === null || h.entry === undefined) ? NaN : +h.entry;
      parts.push(String(h.sym) + ':' + h.dir + (isFinite(e) ? '@' + String(e) : ''));
    }
  }
  parts.sort();
  return parts.join(';');
}
function squeezeDesc(hits){
  var bits = [];
  for (var i = 0; i < hits.length && bits.length < 3; i++){
    var h = hits[i];
    if (!h || !h.sym) continue;
    var head = String(h.sym) + ' ' + String(h.dir || '').toUpperCase()
      + ' (' + (h.kind === 'break' ? 'DONCHIAN BREAK' : 'FIRED') + ')';
    var e = (h.entry === null || h.entry === undefined) ? NaN : +h.entry;
    bits.push(isFinite(e)
      ? head + ' @ ' + e + ' · SL ' + (+h.stop) + ' · TP ' + (+h.t1)
      : head + ' — levels on the SQUEEZE tab');
  }
  return bits.length ? bits.join('\n') + (hits.length > 3 ? '\n+' + (hits.length - 3) + ' more' : '') : '—';
}
function onSqueeze(hits){
  try{
    if (!Array.isArray(hits)) return 'ignored';
    var key = squeezeKeyOf(hits);
    if (__squeezeKey === null){ __squeezeKey = key; __lastSqueezeLine = hhmm() + ' squeeze seeded'; return 'seeded'; }
    if (key === __squeezeKey) return 'unchanged';
    __squeezeKey = key;
    if (!hits.length){ __lastSqueezeLine = hhmm() + ' squeeze board cleared'; return 'cleared'; }
    var desc = squeezeDesc(hits);
    var line = hhmm() + ' SQUEEZE: ' + desc.split('\n')[0];
    if (!__enabled || !__unlocked || !audioOk()){
      __lastSqueezeLine = line + (__enabled ? ' (armed — plays after your next click)' : ' (alerts off)');
      return 'unarmed';
    }
    var now = 0;
    try{ now = Date.now(); }catch(e){ now = 0; }
    if (now - (__lastChime.squeeze || 0) < CHIME_GAP_MS){
      __lastSqueezeLine = line + ' (alert held by 15-min throttle)';
      return 'throttled';
    }
    __lastChime.squeeze = now;
    var suffix;
    if (__muted){ suffix = ' (muted)'; }
    else if (playChime()){ suffix = ''; }
    else { suffix = ' (sound failed)'; }
    var txt = '🌀 HARDGATE SQUEEZE\n'
      + 'Tab: SQUEEZE tab\n'
      + 'Signal: TTM squeeze fired or Donchian break\n'
      + squeezeTelegramBlocks(hits)
      + '\nTTM squeeze fired / Donchian break — momentum release, confirm on the SQUEEZE tab.'
      + offHoursTag()
      + '\nhttps://hardgate-main.onrender.com/';
    try{
      var tg = gfn('sendTelegram');
      if (tg){ suffix += ' · telegram'; Promise.resolve(tg(txt)).then(function(r){
        if (r !== true){ var nt = gfn('sendAlertPush'); if (nt) nt('HARDGATE SQUEEZE', txt, { priority: 4 }); }
      }).catch(function(){ var nt = gfn('sendAlertPush'); if (nt) nt('HARDGATE SQUEEZE', txt, { priority: 4 }); }); }
      else { var nt2 = gfn('sendAlertPush'); if (nt2){ nt2('HARDGATE SQUEEZE', txt, { priority: 4 }); suffix += ' · ntfy p4'; } }
    }catch(e){}
    __lastSqueezeLine = line + suffix;
    return 'alerted';
  }catch(e){ return 'error'; }
}

/* ---------------- (e) DAILY FAMILY DIGEST — the Setup Log's per-family
   track record, pushed once per day at 21:05-21:35 IST while the app is
   open. The log lives in THIS browser (localStorage), so this is the only
   honest source for family hit-rates — the server digest covers market/
   ticket/sniper; this covers the family's own record. Telegram first, ntfy
   fallback; the day stamp persists so exactly one push per day, and a
   failed delivery retries next cycle. Never throws. */
function famDigestText(){
  try{
    var load = gfn('loadLog'), st = gfn('__hgBrainFamStats');
    if (!load || !st) return null;
    var log = load() || [], kinds = {}, i;
    for (i = 0; i < log.length; i++) if (log[i] && log[i].kind) kinds[log[i].kind] = 1;
    var ks = Object.keys(kinds);
    if (!ks.length) return 'no logged setups yet — the family record starts with the next board scan';
    var rows = [];
    for (i = 0; i < ks.length; i++){
      var s = st(log, ks[i]);
      if (s) rows.push(s);
    }
    if (!rows.length) return 'no closed setups graded yet — the record builds as T1/stops print';
    rows.sort(function(a, b){ return b.n - a.n; });
    var lines = [];
    for (i = 0; i < rows.length; i++){
      var r = rows[i];
      lines.push(r.kind + ': ' + r.tp + '/' + r.n + ' (' + r.hitPct + '%) · Σ'
        + (r.sumR > 0 ? '+' : '') + r.sumR + 'R');
    }
    return lines.join('\n');
  }catch(e){ return null; }
}
function maybeFamDigest(nowD){
  try{
    var now = nowD ? new Date(nowD) : new Date();
    var ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
    var mins = ist.getHours() * 60 + ist.getMinutes();
    if (!(mins >= 1265 && mins <= 1295)) return 'outside-window';   /* 21:05-21:35 IST */
    var day = ist.toDateString(), last = null;
    try{ last = localStorage.getItem('hgFamDigestDay'); }catch(e){}
    if (last === day) return 'already-sent';
    var tg = gfn('sendTelegram');
    if (!tg) return 'no-channel';
    var body = famDigestText();
    if (!body) return 'no-data';
    var tickFn = gfn('__hgBrainTicketNow'), tick = null;
    try{ tick = tickFn ? tickFn() : null; }catch(e){}
    var tickLine = 'Ticket: LONG ' + (tick && tick.long ? tick.long.sym + ' @ ' + tick.long.entry : '—')
                 + ' · SHORT ' + (tick && tick.short ? tick.short.sym + ' @ ' + tick.short.entry : '—');
    var txt = '📊 HARDGATE DAILY — Setup Log family records (browser)\n' + tickLine + '\n' + body;
    Promise.resolve(tg(txt)).then(function(r){
      if (r === true){ try{ localStorage.setItem('hgFamDigestDay', day); }catch(e){} return; }
      var topic = null;
      try{ topic = localStorage.getItem('hg_ntfy_topic'); }catch(e){}
      if (topic){
        var nt = gfn('sendAlertPush');
        if (nt) nt('HARDGATE DAILY — family records', txt);
        try{ localStorage.setItem('hgFamDigestDay', day); }catch(e){}
      }
      /* no channel delivered -> no stamp -> honest retry next cycle */
    }).catch(function(){});
    return 'fired';
  }catch(e){ return 'error'; }
}

/* ---------------- evaluation round ---------------- */
function evaluate(){
  var st = {
    enabled: __enabled, unlocked: __unlocked, muted: __muted,
    audioOk: audioOk(), goldMin: __goldMin, chimed: [], note: ''
  };
  if (!__enabled){ st.note = 'alerts off — click the bell to enable'; return st; }
  if (!audioOk()){ st.note = 'sound unavailable in this browser'; return st; }
  if (!__unlocked){ st.note = 'armed — plays after your next click (browser autoplay policy)'; return st; }

  var now = 0;
  try{ now = Date.now(); }catch(e){ now = 0; }

  /* (a) BRAIN — HIGH/PRIME sym+tier set, alert once per NEW set */
  var bq = brainQual();
  __brainLive = bq.live;
  __brainHits = bq.hits;
  if (bq.live && bq.hits.length){
    var key = brainKey(bq.hits);
    var isNew = (key !== __lastBrainKey);
    var realert = (__lastBrainTrigAt > 0) && (now - __lastBrainTrigAt >= BRAIN_REALERT_MS);
    if (isNew || realert){
      __lastBrainKey = key;
      __lastBrainTrigAt = now;
      var line = hhmm() + ' brain ' + brainTopTier(bq.hits) + ': ' + brainSyms(bq.hits);
      var rb = tryChime('brain');
      if (rb === 'played'){
        __lastBrainLine = line;
        st.chimed.push('brain');
      } else if (rb === 'muted'){
        __lastBrainLine = line + ' (muted)';
      } else if (rb === 'throttled'){
        __lastBrainLine = line + ' (chime held by 15-min throttle)';
      } else {
        __lastBrainLine = line + ' (sound failed)';
      }
    }
  } else if (bq.live){
    __lastBrainKey = null;                 /* set went dark -> its return is new */
  }

  /* (b) GOLD — combined qualifying count, alert once per upward crossing */
  var gc = goldCount();
  __gold = gc;
  if (gc.count >= __goldMin){
    if (__goldArmed){
      __goldArmed = false;
      var gline = hhmm() + ' gold setups ' + gc.count + ' >= ' + __goldMin;
      var rg = tryChime('gold');
      if (rg === 'played'){
        __lastGoldLine = gline;
        st.chimed.push('gold');
      } else if (rg === 'muted'){
        __lastGoldLine = gline + ' (muted)';
      } else if (rg === 'throttled'){
        __lastGoldLine = gline + ' (chime held by 15-min throttle)';
      } else {
        __lastGoldLine = gline + ' (sound failed)';
      }
    }
  } else {
    __goldArmed = true;                    /* fell back below threshold -> re-arm */
  }

  __evaluated = true;
  st.brain = { live: bq.live, count: bq.hits.length, syms: brainSyms(bq.hits) };
  st.gold  = { count: gc.count, scalp: gc.scalp, swing: gc.swing,
               scalpLive: gc.scalpLive, swingLive: gc.swingLive, armed: __goldArmed };
  st.note = st.chimed.length ? ('chimed: ' + st.chimed.join(', ')) : 'checked — no new alert conditions';
  maybeFamDigest();   /* daily family-record push (21:05-21:35 IST, once/day) */
  /* live BRAIN/GOLD tab-setup Telegram between 15-min scan cycles */
  try{
    var tabLive = gfn('hgTabAlertsCheckLive');
    if (tabLive) Promise.resolve(tabLive()).catch(function(){});
  }catch(e){}
  renderUI();
  return st;
}

/* ---------------- UI ---------------- */
var AL_CSS = ''
+ '#hgAlertRoot{position:fixed;right:18px;bottom:18px;z-index:9999;font-family:inherit}'
+ '#hgAlertRoot .hgab-btn{display:block;margin-left:auto;padding:8px 14px;border-radius:20px;'
+ 'border:1px solid var(--line,#E2E8F0);background:var(--panel,#FFFFFF);color:var(--txt,#020617);'
+ 'font-size:11px;letter-spacing:.06em;cursor:pointer;box-shadow:0 8px 24px rgba(15,23,42,.12);transition:transform .15s ease,box-shadow .2s}'
+ '#hgAlertRoot .hgab-btn.armed{border-color:rgba(5,150,105,.45);color:#059669}'
+ '#hgAlertRoot .hgab-btn.waiting{border-color:rgba(201,146,26,.50);color:#C9921A}'
+ '#hgAlertRoot .hgab-btn.muted{border-color:rgba(220,38,38,.45);color:#DC2626}'
+ '#hgAlertRoot .hgab-btn.unavailable{color:var(--mut,#64748B);cursor:default}'
+ '#hgAlertRoot .hgab-panel{position:absolute;right:0;bottom:52px;width:290px;padding:12px 14px;'
+ 'border-radius:12px;border:1px solid var(--line,#E2E8F0);background:var(--panel,#FFFFFF);'
+ 'color:var(--txt,#020617);box-shadow:0 12px 40px rgba(15,23,42,.14);font-size:11px;font-weight:500}'
+ '#hgAlertRoot .hgab-title{font-size:10px;letter-spacing:.18em;font-weight:800;margin-bottom:6px}'
+ '#hgAlertRoot .hgab-title span{color:var(--mut,#64748B);font-weight:400;letter-spacing:.04em}'
+ '#hgAlertRoot .hgab-state{margin-bottom:8px;font-weight:700}'
+ '#hgAlertRoot .hgab-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}'
+ '#hgAlertRoot .hgab-mini{padding:3px 9px;border-radius:4px;border:1px solid var(--line,#E2E8F0);'
+ 'background:transparent;color:var(--txt,#020617);font-size:10px;letter-spacing:.1em;cursor:pointer;font-weight:600}'
+ '#hgAlertRoot .hgab-lbl{color:var(--mut,#64748B);font-size:10px;display:flex;gap:5px;align-items:center}'
+ '#hgAlertRoot .hgab-lbl input{width:44px;background:var(--ink,#F8FAFC);color:var(--txt,#020617);'
+ 'border:1px solid var(--line,#E2E8F0);border-radius:4px;padding:2px 5px;font-size:11px}'
+ '#hgAlertRoot .hgab-line{color:var(--mut,#64748B);margin-top:4px;line-height:1.5}'
+ '#hgAlertRoot .hgab-note{color:var(--mut,#64748B);margin-top:8px;font-size:10px;line-height:1.5;'
+ 'border-top:1px solid #E2E8F0;padding-top:6px}';

function bellState(){
  if (!audioOk()) return 'unavailable';
  if (!__enabled) return 'off';
  if (__muted) return 'muted';
  if (!__unlocked) return 'waiting';
  return 'armed';
}
function bellLabel(){
  switch (bellState()){
    case 'unavailable': return '🔕 sound unavailable in this browser';
    case 'off':         return '🔔 click to enable alerts';
    case 'muted':       return '🔕 alerts muted';
    case 'waiting':     return '🔔 armed — plays after your next click';
    default:            return '🔔 alerts armed';
  }
}
function stateLine(){
  switch (bellState()){
    case 'unavailable': return 'sound unavailable in this browser — the bell cannot chime here.';
    case 'off':         return 'alerts off — click the bell to enable (your browser asks for one click before sound).';
    case 'muted':       return 'alerts muted — evaluation continues, chimes stay silent until unmuted.';
    case 'waiting':     return 'armed — plays after your next click (browser autoplay policy).';
    default:            return 'alerts armed — chimes for new brain HIGH/PRIME sets and gold crossings.';
  }
}
function brainLine(){
  if (!__evaluated) return 'brain: not evaluated yet — checks run once alerts are armed';
  if (!__brainLive) return 'brain: waiting for a completed synthesis';
  if (!__brainHits.length) return 'brain: no HIGH/PRIME rows right now';
  return 'brain: ' + brainTopTier(__brainHits) + '/HIGH+ set — ' + brainSyms(__brainHits);
}
function goldLine(){
  if (!__evaluated) return 'gold: not evaluated yet — checks run once alerts are armed';
  var g = __gold;
  var wait = [];
  if (!g.scalpLive) wait.push('scalp');
  if (!g.swingLive) wait.push('swing');
  var s = 'gold: ' + g.count + ' live setups (scalp ' + g.scalp + ' + swing ' + g.swing + ')'
        + ' · threshold ' + __goldMin;
  if (wait.length) s += ' · waiting: ' + wait.join(', ');
  return s;
}
function ticketLine(){
  if (!__ticketLive) return 'ticket: waiting for a completed synthesis — alerts on sym/entry changes';
  return 'ticket: ' + (__ticketDesc || '—');
}
function sniperLine(){
  if (!__sniperLive) return 'sniper: waiting for a completed synthesis — alerts on 20x-grade in-zone entries';
  return 'sniper: ' + (__sniperDesc || 'no sniper-grade cards right now');
}

function renderUI(){
  var ui = __ui;
  if (!ui) return;
  try{
    var stt = bellState();
    if (ui.btn){
      ui.btn.textContent = bellLabel();
      ui.btn.className = 'hgab-btn ' + stt;
    }
    if (ui.panel) ui.panel.style.display = __panelOpen ? 'block' : 'none';
    if (ui.state) ui.state.textContent = stateLine();
    if (ui.mute) ui.mute.textContent = __muted ? 'UNMUTE' : 'MUTE';
    if (ui.minIn && ui.minIn.value !== String(__goldMin)) ui.minIn.value = String(__goldMin);
    if (ui.brain) ui.brain.textContent = brainLine();
    if (ui.gold) ui.gold.textContent = goldLine();
    if (ui.ticket) ui.ticket.textContent = ticketLine();
    if (ui.sniper) ui.sniper.textContent = sniperLine();
    if (ui.lastB) ui.lastB.textContent = 'last brain alert: ' + (__lastBrainLine || 'none yet this session');
    if (ui.lastG) ui.lastG.textContent = 'last gold alert: ' + (__lastGoldLine || 'none yet this session');
    if (ui.lastT) ui.lastT.textContent = 'last ticket alert: ' + (__lastTicketLine || 'none yet this session');
    if (ui.lastS) ui.lastS.textContent = 'last sniper alert: ' + (__lastSniperLine || 'none yet this session');
  }catch(e){ /* rendering never breaks the engine */ }
}

function onBell(){
  try{
    if (!audioOk()){ __panelOpen = !__panelOpen; renderUI(); return; }
    var wasArmed = __enabled && __unlocked;
    if (!__enabled){ __enabled = true; lsSet(LS_ENABLED, '1'); }
    if (!__unlocked) unlockAudio();
    if (!wasArmed && __enabled && __unlocked) playChime();   /* the arming test chime */
    __panelOpen = !__panelOpen;
    if (__enabled && __unlocked && !__evaluated) evaluate(); /* instant honest lines */
    renderUI();
  }catch(e){}
}
function onMute(){
  try{
    __muted = !__muted;
    lsSet(LS_MUTED, __muted ? '1' : '0');
    renderUI();
  }catch(e){}
}
function onMinChange(){
  try{
    var v = __ui && __ui.minIn ? parseInt(__ui.minIn.value, 10) : NaN;
    if (!isFinite(v) || v < 1) v = GOLD_MIN_DEFAULT;
    if (v > 99) v = 99;
    __goldMin = v;
    lsSet(LS_GOLDMIN, String(v));
    renderUI();
  }catch(e){}
}
function onTest(){
  try{ hgAlertTest(); }catch(e){}
}

function buildUI(){
  if (__ui) return;
  try{
    if (typeof document === 'undefined' || !document || typeof document.createElement !== 'function') return;
    if (!document.body || typeof document.body.appendChild !== 'function') return;
    var root = document.createElement('div');
    if (!root) return;
    root.id = 'hgAlertRoot';
    root.innerHTML = ''
      + '<style>' + AL_CSS + '</style>'
      + '<div class="hgab-panel" id="hgAlertPanel" style="display:none">'
      + '<div class="hgab-title">HG ALERTS <span>sound chimes for BRAIN + GOLD + TICKET + SNIPER</span></div>'
      + '<div class="hgab-state" id="hgAlertState"></div>'
      + '<div class="hgab-row">'
      + '<button class="hgab-mini" id="hgAlertMute" type="button">MUTE</button>'
      + '<label class="hgab-lbl">gold threshold <input id="hgAlertMin" type="number" min="1" max="99" step="1"></label>'
      + '<button class="hgab-mini" id="hgAlertTest" type="button">TEST CHIME</button>'
      + '</div>'
      + '<div class="hgab-line" id="hgAlertBrain"></div>'
      + '<div class="hgab-line" id="hgAlertGold"></div>'
      + '<div class="hgab-line" id="hgAlertTicket"></div>'
      + '<div class="hgab-line" id="hgAlertSniper"></div>'
      + '<div class="hgab-line" id="hgAlertLastB"></div>'
      + '<div class="hgab-line" id="hgAlertLastG"></div>'
      + '<div class="hgab-line" id="hgAlertLastT"></div>'
      + '<div class="hgab-line" id="hgAlertLastS"></div>'
      + '<div class="hgab-note">alerts evaluate while the app is open, after scans have run — '
      + 'brain + ticket alerts need a completed synthesis; ticket also pushes to ntfy when a topic is saved</div>'
      + '</div>'
      + '<button class="hgab-btn" id="hgAlertBtn" type="button"></button>';
    document.body.appendChild(root);
    __ui = {
      btn:   root.querySelector ? root.querySelector('#hgAlertBtn') : null,
      panel: root.querySelector ? root.querySelector('#hgAlertPanel') : null,
      state: root.querySelector ? root.querySelector('#hgAlertState') : null,
      mute:  root.querySelector ? root.querySelector('#hgAlertMute') : null,
      minIn: root.querySelector ? root.querySelector('#hgAlertMin') : null,
      test:  root.querySelector ? root.querySelector('#hgAlertTest') : null,
      brain: root.querySelector ? root.querySelector('#hgAlertBrain') : null,
      gold:  root.querySelector ? root.querySelector('#hgAlertGold') : null,
      ticket: root.querySelector ? root.querySelector('#hgAlertTicket') : null,
      sniper: root.querySelector ? root.querySelector('#hgAlertSniper') : null,
      lastB: root.querySelector ? root.querySelector('#hgAlertLastB') : null,
      lastG: root.querySelector ? root.querySelector('#hgAlertLastG') : null,
      lastT: root.querySelector ? root.querySelector('#hgAlertLastT') : null,
      lastS: root.querySelector ? root.querySelector('#hgAlertLastS') : null
    };
    if (__ui.btn && __ui.btn.addEventListener) __ui.btn.addEventListener('click', onBell);
    if (__ui.mute && __ui.mute.addEventListener) __ui.mute.addEventListener('click', onMute);
    if (__ui.minIn && __ui.minIn.addEventListener) __ui.minIn.addEventListener('change', onMinChange);
    if (__ui.test && __ui.test.addEventListener) __ui.test.addEventListener('click', onTest);
    renderUI();
  }catch(e){ /* a broken DOM never breaks the engine */ }
}

/* ---------------- interval (started once, guarded) ---------------- */
function ensureTimer(){
  if (__timer !== null) return;
  try{
    if (typeof setInterval !== 'function') return;
    var iv = setInterval(function(){
      try{ evaluate(); }catch(e){}
    }, INTERVAL_MS);
    __timer = iv;
    try{ if (iv && typeof iv.unref === 'function') iv.unref(); }catch(e2){}   /* never hold a Node process open */
  }catch(e){}
}

/* ---------------- registration ---------------- */
function hgAlertTest(){
  try{
    if (!audioOk()){ renderUI(); return false; }
    if (!__unlocked) unlockAudio();        /* the TEST click is itself a gesture */
    var ok = playChime();                  /* bypasses MUTE — a sound check, not an alert */
    renderUI();
    return ok;
  }catch(e){ return false; }
}
W.hgAlertTicket = function(snap){
  try{ return onTicket(snap); }
  catch(e){ return 'error'; }
};
W.hgAlertSniper = function(hits){
  try{ return onSniper(hits); }
  catch(e){ return 'error'; }
};
W.hgAlertSqueeze = function(hits){
  try{ return onSqueeze(hits); }
  catch(e){ return 'error'; }
};
/* family-digest seams (vm suites): the text builder + the daily tick */
W.__hgFamDigestText = function(){ try{ return famDigestText(); }catch(e){ return null; } };
W.__hgFamDigestTick = function(d){ try{ return maybeFamDigest(d); }catch(e){ return 'error'; } };
/* off-hours tag seam (vm suites): '' or the warning line; never throws */
W.__hgAlertOffHoursTag = function(){ try{ return offHoursTag(); }catch(e){ return ''; } };
W.hgAlertCheck = function(){
  try{ return evaluate(); }
  catch(e){
    return { enabled: __enabled, unlocked: __unlocked, muted: __muted,
             audioOk: audioOk(), goldMin: __goldMin, chimed: [],
             note: 'error: ' + ((e && e.message) ? e.message : String(e)) };
  }
};
W.hgAlertTest = function(){
  try{ return hgAlertTest(); }catch(e){ return false; }
};

try{
  if (typeof document !== 'undefined' && document && !document.body
      && typeof document.addEventListener === 'function'){
    document.addEventListener('DOMContentLoaded', function(){ try{ buildUI(); }catch(e){} });
  }
}catch(e){}
buildUI();
ensureTimer();
})();
