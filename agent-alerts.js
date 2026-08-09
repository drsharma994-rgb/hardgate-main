/* =========================================================================
HARDGATE — agent-alerts.js
AI AGENT tab Telegram alerts — 24/7 workforce scans, push when a great
setup forms with exact ENTRY / SL / TP (mirrors tabalerts.js contract).

Runs on the 5-min alert cycle when alerts are ON. Dedup: hg_agent_alert_keys.
Never throws at load.
========================================================================= */
(function(){
'use strict';

var W = (typeof window !== 'undefined') ? window : globalThis;

var LS_KEYS = 'hg_agent_alert_keys';
var LS_LAST_RUN = 'hg_agent_alert_last_run';
var GAP_MS = 5 * 60 * 1000;
var MIN_SCORE = 35;
var SITE = 'https://hardgate-main.onrender.com/';

function gfn(name){
  try{ if (typeof W[name] === 'function') return W[name]; }catch(e){}
  return null;
}

function fin(v){ return typeof v === 'number' && isFinite(v); }

function hasLevels(s){
  return s && fin(+s.entry) && fin(+s.stop) && fin(+s.t1) && +s.entry !== +s.stop;
}

function setupScore(s){
  if (!s) return 0;
  var score = 0;
  if (s.clean7 || s.clean) score += 50;
  else if (s.nearClean) score += 25;
  if (s.prime) score += 20;
  if (fin(+s.score)) score += Math.min(30, +s.score);
  if (/PRIME|HIGH/i.test(String(s.tier || ''))) score += 15;
  if (hasLevels(s)) score += 10;
  return score;
}

function isGreatSetup(s){
  if (!hasLevels(s)) return false;
  if (s.dir !== 'long' && s.dir !== 'short') return false;
  return setupScore(s) >= MIN_SCORE;
}

function setupKey(s){
  return 'AIAGENT:' + String(s.sym || '') + ':' + String(s.dir || '') + '@' + (+s.entry);
}

function planBlock(s){
  var fmt = gfn('tabAlertFormatPx');
  var px = fmt || function(v){
    var n = +v;
    if (!fin(n)) return '—';
    return String(n);
  };
  var lines = [
    'COIN: ' + String(s.sym || '—'),
    'SIDE: ' + String(s.dir || '—').toUpperCase(),
    'ENTRY: ' + px(s.entry),
    'STOP LOSS: ' + px(s.stop),
    'TAKE PROFIT 1: ' + px(s.t1)
  ];
  if (fin(+s.t2)) lines.push('TAKE PROFIT 2: ' + px(s.t2));
  return lines.join('\n');
}

function hgAgentAlertsFormat(fresh){
  var lines = [];
  for (var i = 0; i < (fresh || []).length; i++){
    var s = fresh[i];
    var tag = s.clean7 ? '✅' : (s.prime ? '🔥' : '🤖');
    var extra = '';
    if (s.agentLabel || s.agentId) extra += ' · ' + (s.agentLabel || s.agentId);
    if (s.venue || s.exchange) extra += ' · ' + (s.venue || s.exchange);
    if (s.style) extra += ' · ' + s.style;
    if (s.tier) extra += ' · ' + s.tier;
    lines.push(tag + ' ' + s.sym + ' ' + String(s.dir).toUpperCase()
      + '\n  AI AGENT workforce' + extra
      + '\n' + planBlock(s).split('\n').map(function(l){ return '  ' + l; }).join('\n'));
  }
  if (!lines.length) return '';
  var hdr = fresh.length === 1
    ? '🤖 HARDGATE — AI AGENT SETUP FORMED'
    : '🤖 HARDGATE — ' + fresh.length + ' AI AGENT SETUPS FORMED';
  return hdr
    + '\nTab: AI AGENT · 24/7 workforce scan'
    + '\nEach row: COIN · ENTRY · STOP LOSS · TAKE PROFIT'
    + '\n\n' + lines.join('\n\n')
    + '\n\n' + SITE;
}

function loadKeys(root){
  try{
    var ls = (root && root.localStorage) ? root.localStorage : null;
    if (!ls) return {};
    var raw = ls.getItem(LS_KEYS);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}

function saveKeys(keys, root){
  try{
    var ls = (root && root.localStorage) ? root.localStorage : null;
    if (ls) ls.setItem(LS_KEYS, JSON.stringify(keys || {}));
  }catch(e){}
}

function markRun(root){
  try{
    var ls = (root && root.localStorage) ? root.localStorage : null;
    if (ls) ls.setItem(LS_LAST_RUN, String(Date.now()));
  }catch(e){}
}

function shouldRun(root, force){
  if (force) return true;
  try{
    var ls = (root && root.localStorage) ? root.localStorage : null;
    if (!ls) return true;
    var t = parseInt(ls.getItem(LS_LAST_RUN) || '0', 10);
    return !(isFinite(t) && t > 0) || (Date.now() - t >= GAP_MS);
  }catch(e){ return true; }
}

function hgAgentAlertsFresh(prev, list, now){
  now = now || Date.now();
  var keys = {};
  var fresh = [];
  for (var k in (prev || {})){
    if (Object.prototype.hasOwnProperty.call(prev, k)){
      var t = +prev[k];
      if (isFinite(t) && (now - t) < GAP_MS * 3) keys[k] = t;
    }
  }
  for (var i = 0; i < (list || []).length; i++){
    var s = list[i];
    if (!isGreatSetup(s)) continue;
    var key = setupKey(s);
    if (keys[key] !== undefined && (now - keys[key]) < GAP_MS) continue;
    fresh.push(s);
    keys[key] = now;
  }
  return { fresh: fresh, keys: keys };
}

function hgAgentAlertsCollect(root){
  root = root || W;
  var out = [];
  var collect = gfn('hgAgentWorkforceCollect');
  if (collect){
    try{
      var list = collect() || [];
      for (var i = 0; i < list.length; i++) if (list[i]) out.push(list[i]);
    }catch(e){}
  }
  return out.filter(isGreatSetup);
}

async function pushTelegram(text){
  var tg = gfn('sendTelegram');
  if (!tg) return 'not-configured';
  try{
    var r = await tg(text);
    return r === true ? 'sent' : String(r);
  }catch(e){ return 'error'; }
}

async function hgAgentAlertsRun(opts){
  opts = opts || {};
  var root = opts.window || W;
  if (!shouldRun(root, !!opts.force)){
    return { pushed: 0, fresh: [], status: 'throttled-5m' };
  }
  if (!opts.dryRun) markRun(root);

  if (!opts.skipScan){
    try{
      if (typeof W.hgWarmLayerIds === 'function'){
        await W.hgWarmLayerIds(['regime', 'engine', 'goldscalp', 'goldswing', 'pine', 'carry', 'brain', 'aiagent']);
      }
    }catch(e1){}
    try{
      if (typeof W.refreshAtomicDesk === 'function') await W.refreshAtomicDesk(true);
    }catch(e2){}
    try{
      if (typeof W.hgAgentSwarmRun === 'function') await W.hgAgentSwarmRun(true);
    }catch(e3){}
  }

  var list = hgAgentAlertsCollect(root);
  var prev = opts.prevKeys || loadKeys(root);
  var fr = hgAgentAlertsFresh(prev, list, Date.now());
  if (!fr.fresh.length){
    return { pushed: 0, fresh: [], keys: fr.keys, status: 'none-new-great-setup' };
  }
  var body = hgAgentAlertsFormat(fr.fresh);
  if (!body) return { pushed: 0, fresh: [], keys: fr.keys, status: 'empty-body' };
  if (opts.dryRun) return { pushed: fr.fresh.length, fresh: fr.fresh, keys: fr.keys, status: 'dry-run', body: body };

  var push = await pushTelegram(body);
  if (push === 'sent'){
    saveKeys(fr.keys, root);
    return { pushed: fr.fresh.length, fresh: fr.fresh, keys: fr.keys, status: 'sent' };
  }
  var nt = gfn('sendAlertPush');
  if (nt){
    try{
      await nt('HARDGATE AI AGENT SETUP', body, { priority: 5 });
      saveKeys(fr.keys, root);
      return { pushed: fr.fresh.length, fresh: fr.fresh, keys: fr.keys, status: 'ntfy-fallback' };
    }catch(e){}
  }
  return { pushed: 0, fresh: fr.fresh, keys: prev, status: 'push-failed:' + push };
}

async function aiAgentAlertWarm(){
  try{
    var r = await hgAgentAlertsRun({ force: false, skipScan: false });
    return (r && r.pushed > 0) ? 'pushed-' + r.pushed : (r.status || 'ok');
  }catch(e){ return 'error'; }
}

W.hgAgentAlertsCollect = hgAgentAlertsCollect;
W.hgAgentAlertsFresh = hgAgentAlertsFresh;
W.hgAgentAlertsFormat = hgAgentAlertsFormat;
W.hgAgentAlertsRun = hgAgentAlertsRun;
W.aiAgentAlertWarm = aiAgentAlertWarm;

W.HG_warmups = W.HG_warmups || [];
var __hasWarm = false;
for (var wi = 0; wi < W.HG_warmups.length; wi++){
  if (W.HG_warmups[wi] && W.HG_warmups[wi].id === 'aiagent-alerts') __hasWarm = true;
}
if (!__hasWarm){
  W.HG_warmups.push({ id: 'aiagent-alerts', label: 'AI AGENT ALERTS', run: aiAgentAlertWarm });
}

if (typeof module !== 'undefined' && module.exports){
  module.exports = {
    hgAgentAlertsCollect: hgAgentAlertsCollect,
    hgAgentAlertsFresh: hgAgentAlertsFresh,
    hgAgentAlertsFormat: hgAgentAlertsFormat,
    hgAgentAlertsRun: hgAgentAlertsRun,
    isGreatSetup: isGreatSetup,
    setupKey: setupKey,
  };
}

})();
