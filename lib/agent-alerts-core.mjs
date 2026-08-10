/* HARDGATE — AI AGENT setup alert helpers (shared browser + server watch). */
import { telegramPlanBlock, hasPlanLevels, fmtPx } from './telegram-plan.mjs';

export const AGENT_ALERT_GAP_MS = 5 * 60 * 1000;
export const AGENT_MIN_SCORE_CLEAN = 35;
export const AGENT_MIN_SCORE_NEAR = 55;
export const AGENT_MIN_SCORE_BRAIN = 45;
export const AGENT_MIN_RR_SWING = 2.0;
export const AGENT_MIN_RR_SCALP = 2.25;

export function agentSetupKey(s){
  if (!s) return '';
  var e = +s.entry;
  return 'AIAGENT:' + String(s.sym || '') + ':' + String(s.dir || '')
    + '@' + (Number.isFinite(e) ? e : 'na');
}

export function agentSetupMinRr(s){
  var st = String((s && s.style) || '').toLowerCase();
  return st === 'scalp' ? AGENT_MIN_RR_SCALP : AGENT_MIN_RR_SWING;
}

export function agentSetupRr(s){
  if (!s) return null;
  if (Number.isFinite(+s.rr)) return +s.rr;
  var e = +s.entry, st = +s.stop, t1 = +s.t1;
  if (Number.isFinite(e) && Number.isFinite(st) && Number.isFinite(t1) && e !== st){
    return Math.abs(t1 - e) / Math.abs(e - st);
  }
  return null;
}

export function agentSetupScore(s){
  if (!s) return 0;
  var score = 0;
  if (s.clean7 || s.clean === true) score += 50;
  else if (s.nearClean) score += 25;
  if (s.prime) score += 20;
  if (Number.isFinite(+s.score)) score += Math.min(30, +s.score);
  if (Number.isFinite(+s.rr)) score += Math.min(15, +s.rr * 4);
  if (/PRIME|HIGH/i.test(String(s.tier || ''))) score += 15;
  if (hasPlanLevels(s)) score += 10;
  return score;
}

export function isGreatAgentSetup(s, minScore){
  if (!hasPlanLevels(s)) return false;
  if (s.dir !== 'long' && s.dir !== 'short') return false;
  var rr = agentSetupRr(s);
  var minRr = agentSetupMinRr(s);
  if (rr != null && rr < minRr) return false;
  var clean = !!(s.clean7 || s.clean === true);
  var score = agentSetupScore(s);
  if (clean) return score >= (minScore != null ? +minScore : AGENT_MIN_SCORE_CLEAN);
  if (s.nearClean) return score >= AGENT_MIN_SCORE_NEAR;
  if (/PRIME|HIGH/i.test(String(s.tier || ''))) return score >= AGENT_MIN_SCORE_BRAIN;
  return false;
}

export function filterGreatSetups(list, minScore){
  return (list || []).filter(function(s){ return isGreatAgentSetup(s, minScore); });
}

export function agentAlertsFresh(prevKeys, list, now, gapMs){
  gapMs = gapMs || AGENT_ALERT_GAP_MS;
  now = now || Date.now();
  var keys = {};
  var fresh = [];
  for (var k in (prevKeys || {})){
    if (Object.prototype.hasOwnProperty.call(prevKeys, k)){
      var t = +prevKeys[k];
      if (Number.isFinite(t) && (now - t) < gapMs * 3) keys[k] = t;
    }
  }
  for (var i = 0; i < (list || []).length; i++){
    var s = list[i];
    var key = agentSetupKey(s);
    if (!key) continue;
    if (keys[key] !== undefined && (now - keys[key]) < gapMs) continue;
    fresh.push(s);
    keys[key] = now;
  }
  return { fresh: fresh, keys: keys };
}

export function agentAlertPlanBlock(s){
  return telegramPlanBlock({
    sym: s.sym,
    dir: s.dir,
    entry: s.entry,
    stop: s.stop,
    t1: s.t1,
    t2: s.t2,
  });
}

export function agentAlertsFormat(fresh, siteUrl){
  siteUrl = siteUrl || 'https://hardgate-main.onrender.com/';
  var lines = [];
  for (var i = 0; i < (fresh || []).length; i++){
    var s = fresh[i];
    var tag = s.clean7 ? '✅' : (s.prime ? '🔥' : '🤖');
    var extra = '';
    if (s.agentLabel || s.agentId) extra += ' · ' + (s.agentLabel || s.agentId);
    if (s.venue || s.exchange) extra += ' · ' + (s.venue || s.exchange);
    if (s.style) extra += ' · ' + s.style;
    if (s.tier) extra += ' · ' + s.tier;
    if (Number.isFinite(+s.rr)) extra += ' · ' + (+s.rr).toFixed(2) + 'R';
    else if (Number.isFinite(+s.entry) && Number.isFinite(+s.stop) && Number.isFinite(+s.t1) && +s.entry !== +s.stop){
      extra += ' · ' + (Math.abs(+s.t1 - +s.entry) / Math.abs(+s.entry - +s.stop)).toFixed(2) + 'R';
    }
    if (s.note) extra += ' · ' + s.note;
    var plan = agentAlertPlanBlock(s).split('\n').map(function(l){ return '  ' + l; }).join('\n');
    lines.push(tag + ' ' + String(s.sym || '—') + ' ' + String(s.dir || '').toUpperCase()
      + '\n  AI AGENT workforce' + extra
      + '\n' + plan);
  }
  if (!lines.length) return '';
  var hdr = fresh.length === 1
    ? '🤖 HARDGATE — AI AGENT SETUP FORMED'
    : '🤖 HARDGATE — ' + fresh.length + ' AI AGENT SETUPS FORMED';
  return hdr
    + '\nTab: AI AGENT · 24/7 workforce + Atomic Delta/CoinDCX'
    + '\nEach row: COIN · ENTRY · STOP LOSS · TAKE PROFIT'
    + '\n\n' + lines.join('\n\n')
    + '\n\n' + siteUrl;
}

export function normalizeAgentSetup(raw){
  if (!raw || typeof raw !== 'object') return null;
  return {
    sym: raw.sym,
    dir: raw.dir,
    entry: raw.entry,
    stop: raw.stop,
    t1: raw.t1,
    t2: raw.t2,
    rr: raw.rr,
    score: raw.score != null ? raw.score : agentSetupScore(raw),
    clean7: !!(raw.clean7 || raw.clean),
    nearClean: !!raw.nearClean,
    prime: !!raw.prime,
    tier: raw.tier,
    style: raw.style,
    venue: raw.venue || raw.exchange || raw.bestVenue,
    exchange: raw.exchange || raw.bestVenue,
    agentLabel: raw.agentLabel || raw.agentId,
    agentId: raw.agentId,
    src: raw.src,
    note: raw.note,
  };
}

export function mergeAgentSetups(lists){
  var out = [];
  var seen = {};
  for (var L = 0; L < (lists || []).length; L++){
    var list = lists[L] || [];
    for (var i = 0; i < list.length; i++){
      var s = normalizeAgentSetup(list[i]);
      if (!s) continue;
      var key = agentSetupKey(s);
      if (seen[key]) continue;
      seen[key] = true;
      out.push(s);
    }
  }
  out.sort(function(a, b){ return agentSetupScore(b) - agentSetupScore(a); });
  return out;
}
