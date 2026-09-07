/* HARDGATE — browser bridge for Increment 3 & 4 adaptive layer */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var __paramDrift = null;
var __symbolTiers = null;
var __alertPrecision = { buckets: {} };
var __regimeHistory = [];
var __prevRegimeSlope = null;
var __transitionUntil = 0;
var LS_REGIME_HIST = 'hg_regime_score_hist_v1';
var LS_ALERT_PREC = 'hg_alert_precision_v1';
var LS_ALERT_LOG = 'hg_alert_outcome_log_v1';

function fin(x){ var n = (typeof x === 'number') ? x : parseFloat(x); return isFinite(n) ? n : null; }

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

function uuid(){
  try{
    if (G.crypto && G.crypto.randomUUID) return G.crypto.randomUUID();
  }catch(e){}
  return 'alt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

/* ---- config load ---- */
async function hgInc34LoadConfigs(force){
  if (!force && __paramDrift && __symbolTiers) return { ok: true };
  try{
    if (typeof fetch !== 'function') return { ok: false };
    var r1 = await fetch('./data/param-drift.json', { cache: 'no-store' });
    if (r1.ok) __paramDrift = await r1.json();
    var r2 = await fetch('./data/symbol-tier.json', { cache: 'no-store' });
    if (r2.ok) __symbolTiers = await r2.json();
    var r3 = await fetch('./data/alert-precision.json', { cache: 'no-store' });
    if (r3.ok){
      var j = await r3.json();
      __alertPrecision = j.buckets ? j : { buckets: j };
    }
    try{
      var ls = G.localStorage && G.localStorage.getItem(LS_ALERT_PREC);
      if (ls) __alertPrecision.buckets = Object.assign(__alertPrecision.buckets || {}, JSON.parse(ls));
    }catch(eLs){}
    try{
      var rh = G.localStorage && G.localStorage.getItem(LS_REGIME_HIST);
      if (rh) __regimeHistory = JSON.parse(rh) || [];
    }catch(eRh){}
    return { ok: true };
  }catch(e){ return { ok: false, error: String(e && e.message || e) }; }
}

function hgInc34Param(key, fallback){
  if (__paramDrift && __paramDrift.params && __paramDrift.params[key] != null) return +__paramDrift.params[key];
  return fallback;
}

function hgSymbolTier(sym){
  sym = String(sym || '').toUpperCase();
  var map = (__symbolTiers && __symbolTiers.symbols) || {};
  return map[sym] || { tier: 'B', reason: 'no tier data' };
}

function hgSymbolTierGate(sym, gatesPassed, gatesTotal){
  var t = hgSymbolTier(sym);
  var tier = t.tier || 'B';
  if (tier === 'C') return { pass: false, veto: true, note: 'Tier C — veto (' + (t.reason || '') + ')' };
  gatesTotal = +gatesTotal || 7;
  gatesPassed = +gatesPassed || 0;
  if (tier === 'B' && gatesPassed < gatesTotal){
    return { pass: false, veto: true, note: 'Tier B requires +1 confluence (' + gatesPassed + '/' + gatesTotal + ')' };
  }
  return { pass: true, veto: false, note: tier + ' ok' };
}

/* ---- correlation dedupe (browser mirror of inc34-core) ---- */
function logRet(closes){
  var o = [];
  if (!closes || closes.length < 2) return o;
  for (var i = 1; i < closes.length; i++){
    var a = +closes[i-1], b = +closes[i];
    if (a > 0 && b > 0) o.push(Math.log(b/a));
  }
  return o;
}
function pairCorr(a, b){
  var ra = logRet(a), rb = logRet(b), m = Math.min(ra.length, rb.length);
  if (m < 20) return null;
  ra = ra.slice(-m); rb = rb.slice(-m);
  var ma = 0, mb = 0, i;
  for (i = 0; i < m; i++){ ma += ra[i]; mb += rb[i]; }
  ma /= m; mb /= m;
  var cov = 0, va = 0, vb = 0;
  for (i = 0; i < m; i++){ var da = ra[i]-ma, db = rb[i]-mb; cov += da*db; va += da*da; vb += db*db; }
  if (!(va > 0) || !(vb > 0)) return null;
  return cov / Math.sqrt(va * vb);
}
function hgCorrDedupeCandidates(candidates, seriesBySym, opts){
  opts = opts || {};
  var thr = opts.corrThr > 0 ? opts.corrThr : 0.7;
  var list = (candidates || []).slice();
  if (list.length < 2) return list;
  var syms = [];
  list.forEach(function(c){ if (c.sym && syms.indexOf(c.sym) < 0) syms.push(c.sym); });
  var clusters = {}, id = 0;
  for (var i = 0; i < syms.length; i++){
    if (clusters[syms[i]] !== undefined) continue;
    clusters[syms[i]] = id;
    for (var j = i + 1; j < syms.length; j++){
      var c = pairCorr(seriesBySym[syms[i]], seriesBySym[syms[j]]);
      if (c !== null && Math.abs(c) >= thr) clusters[syms[j]] = id;
    }
    id++;
  }
  var best = {};
  list.forEach(function(c){
    var key = clusters[c.sym] + '|' + String(c.dir||'').toLowerCase();
    var score = fin(c.score) || fin(c.famScore) || fin(c.rr) || 0;
    var liq = c.turnoverUsd || (c.t && c.t.turnoverUsd) || 0;
    if (!best[key] || score > best[key].score || (score === best[key].score && liq > best[key].liq)){
      best[key] = { c: c, score: score, liq: liq };
    }
  });
  return Object.keys(best).map(function(k){ return best[k].c; });
}

/* ---- regime transition ---- */
function hgRegimeTransitionPush(score){
  score = fin(score);
  if (score === null) return null;
  __regimeHistory.push({ at: Date.now(), score: score });
  __regimeHistory = __regimeHistory.slice(-30);
  try{ if (G.localStorage) G.localStorage.setItem(LS_REGIME_HIST, JSON.stringify(__regimeHistory)); }catch(e){}
  var cutoff = Date.now() - 5 * 86400000;
  var pts = __regimeHistory.filter(function(h){ return h.at >= cutoff; });
  var slope = (pts.length >= 2) ? (pts[pts.length-1].score - pts[0].score) / 5 : null;
  var crossed = (__prevRegimeSlope !== null && slope !== null && __prevRegimeSlope * slope < 0);
  var active = crossed || (slope !== null && Math.abs(slope) >= 0.5);
  if (active) __transitionUntil = Date.now() + 3 * 86400000;
  __prevRegimeSlope = slope;
  G.__hgRegimeTransition = {
    active: active || Date.now() < __transitionUntil,
    slope: slope,
    tag: (active || Date.now() < __transitionUntil) ? 'REGIME TRANSITION' : null,
    until: __transitionUntil
  };
  return G.__hgRegimeTransition;
}

function hgRegimeTransitionModifiers(){
  var tr = G.__hgRegimeTransition || {};
  if (!tr.active) return { tightenRr: 0, halveTimeStop: false, requireCrossVenue: false, minRr: null, note: '' };
  return { tightenRr: 0.5, halveTimeStop: true, requireCrossVenue: true, minRr: 2.5,
    note: 'REGIME TRANSITION — R:R ≥2.5, halve time stops, cross-venue required' };
}

function hgRegimeTransitionBannerHtml(){
  var tr = G.__hgRegimeTransition;
  if (!tr || !tr.active) return '';
  return '<div class="note warn" style="margin:8px 0"><b>' + esc(tr.tag || 'REGIME TRANSITION') + '</b>'
    + ' · 5d score slope ' + (tr.slope != null ? tr.slope.toFixed(2) : 'n/a')
    + ' · Fed liquidity feeds anticipator</div>';
}

/* ---- alert precision ---- */
function apBucket(setup, regime, tier){
  return String(setup||'unknown').toLowerCase() + '|' + String(regime||'MIXED').toUpperCase() + '|' + String(tier||'clean').toLowerCase();
}

function hgAlertRecordFire(meta){
  meta = meta || {};
  var id = uuid();
  var row = {
    id: id, at: Date.now(), sym: meta.sym, dir: meta.dir,
    setup: meta.setup || meta.scanner || 'unknown',
    regime: meta.regime || 'MIXED', tier: meta.tier || 'clean',
    markAtFire: fin(meta.mark) || fin(meta.markPrice) || fin(meta.entry) || null,
    outcome4h: null, outcome24h: null
  };
  try{
    var log = JSON.parse(G.localStorage.getItem(LS_ALERT_LOG) || '[]');
    log.unshift(row);
    G.localStorage.setItem(LS_ALERT_LOG, JSON.stringify(log.slice(0, 500)));
  }catch(e){}
  return row;
}

function hgAlertPrecisionFor(setup, regime, tier){
  var b = apBucket(setup, regime, tier);
  var bucket = (__alertPrecision.buckets || {})[b];
  return bucket && bucket.precision != null ? bucket.precision : null;
}

function hgAlertShouldPush(setup, regime, tier){
  var p = hgAlertPrecisionFor(setup, regime, tier);
  if (p === null) return { allow: true, note: 'no precision history' };
  if (p < 0.4) return { allow: false, note: 'precision ' + (p*100).toFixed(0) + '% < 40%' };
  if (p > 0.6) return { allow: true, promote: true, note: 'precision ' + (p*100).toFixed(0) + '% > 60%' };
  return { allow: true, note: 'precision neutral' };
}

function hgAlertMarkOutcomes(markFn){
  try{
    var log = JSON.parse(G.localStorage.getItem(LS_ALERT_LOG) || '[]');
    var now = Date.now();
    log.forEach(function(row){
      if (!row || row.outcome24h != null) return;
      var ageH = (now - row.at) / 3600000;
      if (typeof markFn === 'function'){
        var o = markFn(row, ageH);
        if (ageH >= 4 && row.outcome4h == null && o && o.h4 != null) row.outcome4h = o.h4;
        if (ageH >= 24 && o && o.h24 != null){
          row.outcome24h = o.h24;
          var bucket = apBucket(row.setup, row.regime, row.tier);
          if (!__alertPrecision.buckets) __alertPrecision.buckets = {};
          if (!__alertPrecision.buckets[bucket]) __alertPrecision.buckets[bucket] = { fired: 0, wins: 0, losses: 0, precision: null };
          var b = __alertPrecision.buckets[bucket];
          b.fired += 1;
          if (o.h24 > 0) b.wins += 1; else b.losses += 1;
          b.precision = b.fired ? b.wins / b.fired : null;
        }
      }
    });
    G.localStorage.setItem(LS_ALERT_LOG, JSON.stringify(log));
    G.localStorage.setItem(LS_ALERT_PREC, JSON.stringify(__alertPrecision.buckets));
  }catch(e){}
}

function hgAlertOutcomeMarkFromTickers(row, ageH){
  var out = {};
  if (!row || !row.sym || !(row.markAtFire > 0)) return out;
  var tick = null;
  try{
    if (G.S && G.S.tickers) tick = G.S.tickers[row.sym];
    else if (G.tickers) tick = G.tickers[row.sym];
  }catch(e){}
  var mark = tick && (fin(tick.mark) || fin(tick.last));
  if (!(mark > 0)) return out;
  var move = String(row.dir || '').toLowerCase() === 'long'
    ? (mark - row.markAtFire) / row.markAtFire
    : (row.markAtFire - mark) / row.markAtFire;
  var sig = move > 0.002 ? 1 : (move < -0.002 ? -1 : 0);
  if (ageH >= 4 && row.outcome4h == null) out.h4 = sig;
  if (ageH >= 24 && row.outcome24h == null) out.h24 = sig;
  return out;
}

function hgBookImbalanceConfluence(sym, dir){
  return (typeof G.hgBookImbalanceTag === 'function')
    ? G.hgBookImbalanceTag(sym).then(function(bal){
        if (!bal || !bal.extreme) return null;
        dir = String(dir || '').toLowerCase();
        var tag = bal.ratio >= 2 ? 'BID HEAVY CONFLUENCE' : (bal.ratio <= 0.5 ? 'ASK HEAVY CONFLUENCE' : null);
        if (!tag) return null;
        var withSetup = (dir === 'long' && bal.ratio >= 2) || (dir === 'short' && bal.ratio <= 0.5);
        return { tag: tag, withSetup: withSetup, ratio: bal.ratio, caution: !withSetup };
      })
    : Promise.resolve(null);
}

G.hgInc34LoadConfigs = hgInc34LoadConfigs;
G.hgInc34Param = hgInc34Param;
G.hgSymbolTier = hgSymbolTier;
G.hgSymbolTierGate = hgSymbolTierGate;
G.hgCorrDedupeCandidates = hgCorrDedupeCandidates;
G.hgRegimeTransitionPush = hgRegimeTransitionPush;
G.hgRegimeTransitionModifiers = hgRegimeTransitionModifiers;
G.hgRegimeTransitionBannerHtml = hgRegimeTransitionBannerHtml;
G.hgAlertRecordFire = hgAlertRecordFire;
G.hgAlertShouldPush = hgAlertShouldPush;
G.hgAlertMarkOutcomes = hgAlertMarkOutcomes;
G.hgAlertOutcomeMarkFromTickers = hgAlertOutcomeMarkFromTickers;
G.hgBookImbalanceConfluence = hgBookImbalanceConfluence;

try{
  if (G.document){
    var boot = function(){ hgInc34LoadConfigs(); };
    if (G.document.readyState === 'loading') G.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
}catch(e){}
})();
