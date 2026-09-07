/* =========================================================================
HARDGATE — setup-calibration.js (Increment 2)
Setup calibration & context conditioning: historical edge profiles, regime-
conditional gate tightening, cross-tab confluence tiering, vol-adaptive R:R,
time stops, cross-venue agreement gates.

Loads data/setup-profile.json + data/regime-profile.json (embedded fallbacks).
Pure logic mirrored in lib/setup-calibration-core.mjs for Node tests.
========================================================================= */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var SC_MIN_SAMPLE = 20;
var SC_PROFILE = null;
var SC_REGIME_PROFILE = null;
var SC_PROFILE_AT = 0;

var SC_EMBED_PROFILE = {"version":1,"minSample":20,"computedAt":null,"setups":{},"timeStopDefaults":{"scalp":{"bars":12,"res":"15m"},"swing":{"bars":60,"res":"4h"},"best":{"bars":60,"res":"4h"},"gold-swing":{"bars":30,"res":"4h"},"judas":{"bars":8,"res":"1h"},"smc-fvg":{"bars":5,"res":"4h"}}};
var SC_EMBED_REGIME = {"version":1,"setups":{"swing":{"homeRegime":"trend","macro":{"fullStrengthMinAbs":3,"extraConfluenceMinAbs":1,"vetoMaxAbs":0.99}},"meanrev":{"homeRegime":"chop","macro":{"fullStrengthMinAbs":3,"extraConfluenceMinAbs":1,"vetoMaxAbs":99}},"judas":{"homeRegime":"session","sessionOverlapOnly":true}}};

function fin(x){ var n = (typeof x === 'number') ? x : parseFloat(x); return isFinite(n) ? n : null; }

function scMacroRegimeBucket(score){
  var s = fin(score);
  if (s === null) return 'chop';
  if (s >= 3) return 'risk-on';
  if (s <= -3) return 'risk-off';
  return 'chop';
}

function scTapeRegimeBucket(tape){
  var t = String(tape || '').toLowerCase();
  if (!t || t === 'n/a' || t.indexOf('data thin') >= 0) return 'chop';
  if (t.indexOf('compression') >= 0 || t.indexOf('chop') >= 0 || t.indexOf('weak') >= 0) return 'chop';
  if (t.indexOf('volatile') >= 0) return 'chop';
  return 'trend';
}

function scNormalizeSetupKind(kind){
  var k = String(kind || 'swing').toLowerCase();
  if (k === 'best') return 'swing';
  if (k.indexOf('gold') >= 0 && k.indexOf('scalp') >= 0) return 'gold-scalp';
  if (k.indexOf('gold') >= 0) return 'gold-swing';
  if (k.indexOf('gs') === 0) return k;
  if (k.indexOf('judas') >= 0) return 'judas';
  if (k.indexOf('smc') >= 0 || k.indexOf('fvg') >= 0) return 'smc-fvg';
  if (k === 'trap' || k.indexOf('mean') >= 0) return 'meanrev';
  return k;
}

function scBlankBucket(){ return { n:0, wins:0, losses:0, sumWinR:0, sumLossR:0, sumR:0, winBars:[] }; }

function scAccBucket(b, trade){
  b.n += 1;
  var r = fin(trade.r);
  if (r === null) return b;
  b.sumR += r;
  if (r > 0){ b.wins += 1; b.sumWinR += r; if (fin(trade.barsToOutcome) !== null) b.winBars.push(trade.barsToOutcome); }
  else { b.losses += 1; b.sumLossR += Math.abs(r); }
  return b;
}

function scFinalizeBucket(b){
  var n = b.n || 0, wr = n ? b.wins / n : null;
  var avgWin = b.wins ? b.sumWinR / b.wins : null;
  var avgLoss = b.losses ? b.sumLossR / b.losses : null;
  var exp = null;
  if (n && wr !== null && avgWin !== null && avgLoss !== null) exp = wr * avgWin - (1 - wr) * avgLoss;
  else if (n) exp = b.sumR / n;
  var medianWinBars = null;
  if (b.winBars && b.winBars.length){
    var s = b.winBars.slice().sort(function(a,c){ return a-c; });
    var m = Math.floor(s.length / 2);
    medianWinBars = s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
  }
  return { n:n, wins:b.wins, losses:b.losses,
    wr: wr !== null ? Math.round(wr*1000)/1000 : null,
    avgWinR: avgWin !== null ? Math.round(avgWin*1000)/1000 : null,
    avgLossR: avgLoss !== null ? Math.round(avgLoss*1000)/1000 : null,
    expectancy: exp !== null ? Math.round(exp*1000)/1000 : null,
    medianWinBars: medianWinBars !== null ? Math.round(medianWinBars*10)/10 : null };
}

function scBuildProfileFromSources(logEntries, scoreRecords, opts){
  opts = opts || {};
  var minSample = fin(opts.minSample); if (minSample === null) minSample = SC_MIN_SAMPLE;
  var setups = {}, trades = [];
  var SEC = { '15m':900, '1h':3600, '4h':14400, '1d':86400 };
  function pushTrade(kind, rb, r, bars){ trades.push({ kind: scNormalizeSetupKind(kind), regimeBucket: rb, r: r, barsToOutcome: bars }); }
  var logs = Array.isArray(logEntries) ? logEntries : [];
  for (var i = 0; i < logs.length; i++){
    var e = logs[i]; if (!e) continue;
    var st = String(e.status || '');
    if (st !== 'tp' && st !== 'sl' && st !== 'time_stop') continue;
    var r = fin(e.rr);
    if (st === 'sl') r = -1;
    else if (st === 'time_stop') r = fin(e.rr); if (r === null && st === 'time_stop') r = -0.1;
    else if (r === null) r = 2;
    var bars = null;
    if (e.filledTs && e.doneTs && e.res && SEC[e.res]) bars = Math.max(1, Math.round((e.doneTs - e.filledTs) / SEC[e.res]));
    pushTrade(e.kind || 'swing', scMacroRegimeBucket(e.regimeScore), r, bars);
  }
  var recs = Array.isArray(scoreRecords) ? scoreRecords : [];
  for (var j = 0; j < recs.length; j++){
    var rec = recs[j];
    if (!rec || rec.status !== 'settled') continue;
    var rv = fin(rec.r != null ? rec.r : rec.rNet);
    if (rv === null) continue;
    pushTrade(rec.poiKind || rec.kind || rec.lane || rec.source || 'swing', 'chop', rv, fin(rec.barsToOutcome));
  }
  for (var t = 0; t < trades.length; t++){
    var tr = trades[t], kind = tr.kind;
    if (!setups[kind]) setups[kind] = { 'risk-on':scBlankBucket(), 'risk-off':scBlankBucket(), chop:scBlankBucket(), trend:scBlankBucket(), all:scBlankBucket() };
    scAccBucket(setups[kind][tr.regimeBucket], tr);
    scAccBucket(setups[kind].all, tr);
  }
  var out = { version:1, minSample:minSample, computedAt: Date.now(), setups:{} };
  for (var k2 in setups){
    out.setups[k2] = {};
    for (var b2 in setups[k2]) out.setups[k2][b2] = scFinalizeBucket(setups[k2][b2]);
  }
  return out;
}

function scProfileLookup(profile, setupKind, regimeBucket){
  profile = profile || {};
  var kind = scNormalizeSetupKind(setupKind);
  var row = (profile.setups || {})[kind] || (profile.setups || {}).swing;
  if (!row) return null;
  var bucket = row[regimeBucket] || row.chop || row.all;
  if (!bucket || !bucket.n) return row.all && row.all.n ? Object.assign({}, row.all, { source:'all' }) : null;
  return Object.assign({}, bucket, { source: regimeBucket });
}

function scProfileAnnotate(profile, setupKind, regimeScore, opts){
  opts = opts || {};
  var minSample = fin(opts.minSample); if (minSample === null) minSample = (profile && profile.minSample) || SC_MIN_SAMPLE;
  var bucket = scMacroRegimeBucket(regimeScore);
  var row = scProfileLookup(profile, setupKind, bucket);
  if (!row || !row.n) return { tag:'insufficient-sample', line:'historical edge: insufficient sample (< '+minSample+')', allowBest:true, n:0 };
  var wrPct = row.wr !== null ? Math.round(row.wr * 100) : null;
  var exp = row.expectancy;
  var line = 'hist edge '+bucket+': n='+row.n+(wrPct!==null?' · WR '+wrPct+'%':'')+(exp!==null?' · exp '+(exp>=0?'+':'')+exp.toFixed(2)+'R':'');
  if (row.n < minSample) return { tag:'insufficient-sample', line:line+' — below '+minSample+' trades', allowBest:false, n:row.n, expectancy:exp, wr:row.wr };
  if (exp !== null && exp < 0) return { tag:'negative-ev-regime', line:line+' — negative EV in this regime', allowBest:false, n:row.n, expectancy:exp, wr:row.wr };
  return { tag:null, line:line, allowBest:true, n:row.n, expectancy:exp, wr:row.wr, medianWinBars:row.medianWinBars };
}

function scRegimeConditionalGate(regimeProfile, setupKind, macroScore, tapeRegime, gatesPassed, opts){
  opts = opts || {};
  var cfg = (regimeProfile && regimeProfile.setups) ? regimeProfile.setups[scNormalizeSetupKind(setupKind)] : null;
  if (!cfg) return { allow:true, reason:null, extraConfluence:0 };
  var abs = Math.abs(fin(macroScore) || 0);
  var home = String(cfg.homeRegime || 'trend');
  var macro = cfg.macro || {};
  var fullMin = fin(macro.fullStrengthMinAbs); if (fullMin === null) fullMin = 3;
  var extraMin = fin(macro.extraConfluenceMinAbs); if (extraMin === null) extraMin = 1;
  var vetoMax = fin(macro.vetoMaxAbs); if (vetoMax === null) vetoMax = 0.99;
  var kind = scNormalizeSetupKind(setupKind);

  if (home === 'trend' || kind === 'swing' || kind === 'edge'){
    if (abs < vetoMax) return { allow:false, reason:'regime chop — trend setup vetoed', extraConfluence:0 };
    if (abs >= fullMin) return { allow:true, reason:null, extraConfluence:0 };
    if (abs >= extraMin) return { allow:true, reason:'regime mixed — needs extra confluence', extraConfluence:1 };
    return { allow:false, reason:'regime too weak for trend setup', extraConfluence:0 };
  }
  if (home === 'chop' || kind === 'meanrev' || kind === 'trap'){
    if (abs >= fullMin) return { allow:false, reason:'strong macro trend — mean-reversion vetoed', extraConfluence:0 };
    return { allow:true, reason:null, extraConfluence:0 };
  }
  if (cfg.sessionOverlapOnly && !(opts && opts.sessionOverlap)){
    return { allow:false, reason:'session gate — London/NY overlap required', extraConfluence:0 };
  }
  return { allow:true, reason:null, extraConfluence:0 };
}

function scConfluenceTier(hits){ var h = fin(hits) || 0; if (h >= 2) return 1; if (h === 1) return 2; return 3; }

function scCrossTabPublishers(){
  var pubs = [];
  if (G.HG_squeezeResults) pubs.push(G.HG_squeezeResults);
  if (typeof G.edgeState === 'function'){ try{ var es = G.edgeState(); if (es) pubs.push(es); }catch(e){} }
  if (typeof G.squeezeState === 'function'){ try{ var sq = G.squeezeState(); if (sq) pubs.push(sq); }catch(e){} }
  if (typeof G.meanRevState === 'function'){ try{ var mr = G.meanRevState(); if (mr) pubs.push(mr); }catch(e){} }
  return pubs;
}

function scCountCrossTabHits(sym, dir){
  var pubs = scCrossTabPublishers(), hits = 0, d = String(dir||'').toLowerCase();
  for (var i = 0; i < pubs.length; i++){
    var pub = pubs[i];
    if (!pub || !Array.isArray(pub.results)) continue;
    for (var j = 0; j < pub.results.length; j++){
      var r = pub.results[j];
      if (!r || String(r.sym) !== String(sym)) continue;
      var rd = String(r.dir || '').toLowerCase();
      if (!rd || rd === d){ hits += 1; break; }
    }
  }
  return hits;
}

function scAtrPercentileRank(rows, atrLen, lookback){
  atrLen = atrLen || 14; lookback = lookback || 90;
  if (!Array.isArray(rows) || rows.length < atrLen + 5 || typeof atr !== 'function') return { pct:null, atrNow:null };
  var series = atr(rows, atrLen), vals = [];
  for (var i = Math.max(0, series.length - lookback); i < series.length; i++){
    if (isFinite(series[i]) && series[i] > 0) vals.push(series[i]);
  }
  if (!vals.length) return { pct:null, atrNow:null };
  var now = vals[vals.length-1], below = 0;
  for (var k = 0; k < vals.length; k++){ if (vals[k] <= now) below++; }
  return { pct: Math.round(below / vals.length * 100), atrNow: now, n: vals.length };
}

function scVolAdaptiveRr(atrPctRank, volRatio, base){
  base = base || {};
  var sm = fin(base.stopMult); if (sm === null) sm = 1;
  var rr = fin(base.rrMin); if (rr === null) rr = 2;
  var rank = fin(atrPctRank), vr = fin(volRatio);
  if (vr !== null){ if (vr > 1.2) sm *= 1.25; else if (vr < 0.8) sm *= 0.85; }
  if (rank !== null){ if (rank >= 80) rr = Math.max(rr, 2.5); else if (rank <= 20) rr = Math.min(rr, 1.8); }
  return { stopMult: Math.round(sm*1000)/1000, rrMin: Math.round(rr*100)/100 };
}

function scEmaCascadeDir(rows){
  if (!Array.isArray(rows) || rows.length < 55 || typeof ema !== 'function') return null;
  var c = rows.map(function(r){ return r.c; });
  var e9 = ema(c,9), e21 = ema(c,21), e50 = ema(c,50), k = c.length-1;
  if (c[k] > e21[k] && e21[k] > e50[k]) return 'long';
  if (c[k] < e21[k] && e21[k] < e50[k]) return 'short';
  return null;
}

function scCrossVenueSwingGate(dir, primaryRows, refRows){
  var d = String(dir||'').toLowerCase();
  var pDir = scEmaCascadeDir(primaryRows), rDir = scEmaCascadeDir(refRows);
  if (!pDir || !rDir) return { pass:true, unchecked:true, reason:'cross-venue: reference thin' };
  if (pDir !== d || rDir !== d) return { pass:false, reason:'cross-venue cascade disagreement' };
  return { pass:true, reason:'cross-venue aligned' };
}

function scGoldBasisGate(dir, perpPx, spotPx){
  var p = fin(perpPx), s = fin(spotPx);
  if (p === null || s === null || !(s > 0)) return { pass:true, unchecked:true };
  var basisPct = (p - s) / s * 100;
  if (Math.abs(basisPct) >= 0.3) return { pass:false, reason:'gold basis dislocation '+basisPct.toFixed(2)+'%' };
  return { pass:true, reason:'basis '+basisPct.toFixed(2)+'%' };
}

function scTripleWitnessGate(dir, retailLongPct, topLongPct, takerRatio){
  var d = String(dir||'').toLowerCase(), w = 0;
  var retail = fin(retailLongPct), top = fin(topLongPct), taker = fin(takerRatio);
  if (d === 'long'){
    if (retail !== null && retail < 55) w++;
    if (top !== null && top > 55) w++;
    if (taker !== null && taker > 1) w++;
  } else {
    if (retail !== null && retail > 45) w++;
    if (top !== null && top < 45) w++;
    if (taker !== null && taker < 1) w++;
  }
  return { pass: w >= 2, witnesses: w, reason: w+'/3 positioning witnesses' };
}

function scTimeStopMaxBars(setupKind, profileRow, profile){
  var med = profileRow && fin(profileRow.medianWinBars);
  if (med !== null && med > 0) return Math.max(2, Math.round(med * 2));
  var defs = (profile && profile.timeStopDefaults) || SC_EMBED_PROFILE.timeStopDefaults || {};
  var d = defs[scNormalizeSetupKind(setupKind)] || defs.swing || {};
  return fin(d.bars) || 48;
}

function scResolveRegimeScore(){
  if (typeof G.hgRegimeResolveState === 'function'){
    try{ var rs = G.hgRegimeResolveState(); return fin(rs && rs.score) || 0; }catch(e){}
  }
  if (typeof G.regimeState === 'function'){
    try{ var st = G.regimeState(); return fin(st && st.score) || 0; }catch(e){}
  }
  return 0;
}

function scSessionOverlapNow(){
  try{
    if (typeof bestSessionActive === 'function') return !!bestSessionActive();
  }catch(e){}
  var d = new Date(), h = d.getUTCHours();
  return (h >= 12 && h < 17);
}

function hgSetupProfileGet(){
  return SC_PROFILE || SC_EMBED_PROFILE;
}

function hgRegimeProfileGet(){
  return SC_REGIME_PROFILE || SC_EMBED_REGIME;
}

function hgSetupProfileRefresh(){
  var logs = [];
  try{ if (typeof loadLog === 'function') logs = loadLog(); }catch(e){}
  var recs = [];
  try{ if (typeof G.hgScoreRecords === 'function') recs = G.hgScoreRecords(); }catch(e){}
  SC_PROFILE = scBuildProfileFromSources(logs, recs, { minSample: SC_MIN_SAMPLE });
  SC_PROFILE_AT = Date.now();
  try{ localStorage.setItem('hg_setup_profile_v1', JSON.stringify(SC_PROFILE)); }catch(e){}
  return SC_PROFILE;
}

function hgSetupProfileLoad(){
  try{
    var raw = localStorage.getItem('hg_setup_profile_v1');
    if (raw){ SC_PROFILE = JSON.parse(raw); SC_PROFILE_AT = SC_PROFILE.computedAt || Date.now(); return SC_PROFILE; }
  }catch(e){}
  return hgSetupProfileRefresh();
}

function hgSetupProfileAnnotate(setupKind, regimeScore){
  return scProfileAnnotate(hgSetupProfileGet(), setupKind, regimeScore != null ? regimeScore : scResolveRegimeScore());
}

function hgSetupProfileChipHtml(ann){
  if (!ann || !ann.line) return '';
  var cls = ann.tag === 'negative-ev-regime' ? 'bad' : (ann.tag ? 'warn' : 'ok');
  return '<span class="gpip '+cls+'" title="'+String(ann.line).replace(/"/g,'&quot;')+'">'+String(ann.line).replace(/</g,'&lt;')+'</span>';
}

function hgSetupConfluenceTier(sym, dir){
  return scConfluenceTier(scCountCrossTabHits(sym, dir));
}

function hgSetupCalibrationEval(ctx){
  ctx = ctx || {};
  var kind = scNormalizeSetupKind(ctx.setupKind || ctx.kind || 'swing');
  var regimeScore = ctx.regimeScore != null ? ctx.regimeScore : scResolveRegimeScore();
  var tape = ctx.tapeRegime || 'n/a';
  var out = { veto:false, reasons:[], profile:null, regimeGate:null, tier:3, vol:null };

  out.profile = scProfileAnnotate(hgSetupProfileGet(), kind, regimeScore);
  if (out.profile && !out.profile.allowBest) out.veto = true;
  if (out.profile && out.profile.tag) out.reasons.push(out.profile.tag);

  out.regimeGate = scRegimeConditionalGate(hgRegimeProfileGet(), kind, regimeScore, tape, ctx.gatesPassed, {
    sessionOverlap: ctx.sessionOverlap != null ? ctx.sessionOverlap : scSessionOverlapNow()
  });
  if (out.regimeGate && !out.regimeGate.allow) out.veto = true;
  if (out.regimeGate && out.regimeGate.reason) out.reasons.push(out.regimeGate.reason);
  if (out.regimeGate && out.regimeGate.extraConfluence > 0 && fin(ctx.famScore) !== null){
    var need = (fin(ctx.famMax) || 9) + out.regimeGate.extraConfluence;
    if (ctx.famScore < need){ out.veto = true; out.reasons.push('extra confluence required ('+ctx.famScore+'<'+need+')'); }
  }

  out.tier = hgSetupConfluenceTier(ctx.sym, ctx.dir);
  if (ctx.requireTier12 && out.tier >= 3) out.veto = true;

  if (ctx.rows && typeof atr === 'function'){
    var atrRank = scAtrPercentileRank(ctx.rows, 14, 90);
    out.vol = scVolAdaptiveRr(atrRank.pct, ctx.volRatio, { stopMult:1, rrMin: fin(ctx.rrMin) || 2 });
    out.atrPct = atrRank.pct;
  }

  if (ctx.refRows && ctx.rows && ctx.dir){
    var cv = scCrossVenueSwingGate(ctx.dir, ctx.rows, ctx.refRows);
    out.crossVenue = cv;
    if (cv && cv.pass === false) out.veto = true;
  }

  if (ctx.retailLongPct != null || ctx.topLongPct != null){
    var tw = scTripleWitnessGate(ctx.dir, ctx.retailLongPct, ctx.topLongPct, ctx.takerRatio);
    out.tripleWitness = tw;
    if (ctx.requireTripleWitness && !tw.pass) out.veto = true;
  }

  return out;
}

function hgSetupTimeStopBars(setupKind){
  var prof = hgSetupProfileGet();
  var ann = scProfileLookup(prof, setupKind, scMacroRegimeBucket(scResolveRegimeScore()));
  return scTimeStopMaxBars(setupKind, ann, prof);
}

function hgSetupVolAdaptive(rows, volRatio, rrMin){
  var rank = scAtrPercentileRank(rows, 14, 90);
  return scVolAdaptiveRr(rank.pct, volRatio, { stopMult:1, rrMin: rrMin || 2 });
}

async function hgSetupCrossVenueRows(sym){
  try{
    if (typeof G.biasBinanceSymbol !== 'function' || typeof G.binanceKlines !== 'function') return null;
    var bSym = G.biasBinanceSymbol(sym);
    if (!bSym || bSym === sym) return null;
    return await G.binanceKlines(bSym, '4h', 120);
  }catch(e){ return null; }
}

function hgSetupCalibrationBoot(){
  hgSetupProfileLoad();
  if (typeof fetch === 'function'){
    fetch('./data/regime-profile.json', { cache:'no-store' }).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ if (j) SC_REGIME_PROFILE = j; }).catch(function(){});
    fetch('./data/setup-profile.json', { cache:'no-store' }).then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ if (j && j.setups && Object.keys(j.setups).length) SC_PROFILE = j; }).catch(function(){});
  }
}

G.SC_MIN_SAMPLE = SC_MIN_SAMPLE;
G.hgSetupProfileGet = hgSetupProfileGet;
G.hgRegimeProfileGet = hgRegimeProfileGet;
G.hgSetupProfileRefresh = hgSetupProfileRefresh;
G.hgSetupProfileLoad = hgSetupProfileLoad;
G.hgSetupProfileAnnotate = hgSetupProfileAnnotate;
G.hgSetupProfileChipHtml = hgSetupProfileChipHtml;
G.hgSetupConfluenceTier = hgSetupConfluenceTier;
G.hgSetupCalibrationEval = hgSetupCalibrationEval;
G.hgSetupTimeStopBars = hgSetupTimeStopBars;
G.hgSetupVolAdaptive = hgSetupVolAdaptive;
G.hgSetupCrossVenueRows = hgSetupCrossVenueRows;
G.hgSetupCalibrationBoot = hgSetupCalibrationBoot;
G.scBuildProfileFromSources = scBuildProfileFromSources;
G.scProfileAnnotate = scProfileAnnotate;
G.scRegimeConditionalGate = scRegimeConditionalGate;
G.scVolAdaptiveRr = scVolAdaptiveRr;
G.scCrossVenueSwingGate = scCrossVenueSwingGate;
G.scTripleWitnessGate = scTripleWitnessGate;
G.scGoldBasisGate = scGoldBasisGate;

try{
  if (G.document){
    if (G.document.readyState === 'loading') G.document.addEventListener('DOMContentLoaded', hgSetupCalibrationBoot);
    else hgSetupCalibrationBoot();
  }
}catch(e){}

})();
