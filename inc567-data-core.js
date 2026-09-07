/* HARDGATE — browser bridge for Increments 5, 6, 7 integration.
   Aggregates on-chain alt data, strategy weights, and gate helpers for scans/book/trade plan. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var __snap = null;
var __cacheAt = 0;
var CACHE_MS = 5 * 60 * 1000;
var STABLE_TRACK_KEY = 'hg_stable_contraction_days_v1';

function fin(x){
  var n = (typeof x === 'number') ? x : parseFloat(x);
  return isFinite(n) ? n : null;
}

function hgStableContractionDays(){
  try{
    var v = localStorage.getItem(STABLE_TRACK_KEY);
    return v ? Math.max(0, parseInt(v, 10) || 0) : 0;
  }catch(e){ return 0; }
}

function hgStableContractionTrack(delta7dUSD){
  try{
    var contracting = fin(delta7dUSD) !== null && delta7dUSD < 0;
    var cur = hgStableContractionDays();
    localStorage.setItem(STABLE_TRACK_KEY, String(contracting ? cur + 1 : 0));
  }catch(e){}
}

async function hgOnchainAltFetch(force){
  if (!force && __snap && (Date.now() - __cacheAt) < CACHE_MS) return __snap;
  var notes = [];
  var snap = {
    netflowZ: null,
    stableCadence: null,
    tetherPrint: null,
    minerCycle: null,
    whaleTxs: [],
    lthSth: null,
    notes: notes,
    at: Date.now()
  };

  if (typeof G.onchainState === 'function' && typeof G.hgMinerCycleContext === 'function'){
    try{
      var oc = G.onchainState();
      var sig = (oc && oc.signal) ? oc.signal
        : ((oc && oc.snap && typeof G.onchainSignal === 'function') ? G.onchainSignal(oc.snap) : null);
      var hrTrend = oc && oc.hashrate ? oc.hashrate.trendPct : null;
      var ribbon = (sig && sig.flags && sig.flags.capitulation) ? 'capitulation-recovery'
        : ((hrTrend !== null && hrTrend < -1) ? 'falling-hash' : 'neutral');
      snap.minerCycle = G.hgMinerCycleContext(null, hrTrend, ribbon);
    }catch(eMn){ notes.push('miner: ' + (eMn && eMn.message || eMn)); }
  }

  if (typeof G.regimeState === 'function'){
    try{
      var rg = G.regimeState();
      if (rg && rg.stables && typeof G.hgAnalyzeStableCadence === 'function'){
        var st = rg.stables;
        hgStableContractionTrack(st.delta7dUSD);
        snap.stableCadence = G.hgAnalyzeStableCadence(
          st.totalUSD, st.delta7dUSD, st.delta30dUSD, hgStableContractionDays()
        );
        if (typeof G.hgDetectTetherPrint === 'function'){
          var mint24 = fin(st.usdtMint24h);
          if (mint24 === null && fin(st.usdtUSD) && fin(st.usdtDayAgoUSD)){
            mint24 = st.usdtUSD - st.usdtDayAgoUSD;
          }
          snap.tetherPrint = G.hgDetectTetherPrint(mint24);
        }
      }
    }catch(eRg){ notes.push('stable: ' + (eRg && eRg.message || eRg)); }
  }

  try{
    if (typeof fetch === 'function'){
      var r = await fetch('/api/onchain-alt/desk', { signal: AbortSignal.timeout(12000) });
      if (r.ok){
        var j = await r.json();
        if (j && Array.isArray(j.flows7d) && typeof G.hgCalcNetflowZ === 'function'){
          snap.netflowZ = G.hgCalcNetflowZ(j.flows7d);
        }
        if (j && Array.isArray(j.whaleTxs)) snap.whaleTxs = j.whaleTxs;
        if (j && j.puell != null && typeof G.hgMinerCycleContext === 'function'){
          var ribbon = (snap.minerCycle && snap.minerCycle.hashRibbonState) || 'neutral';
          var hrTrend = (snap.minerCycle && snap.minerCycle.hashrateTrendPct) || null;
          snap.minerCycle = G.hgMinerCycleContext(j.puell, hrTrend, ribbon);
        }
        if (j && j.lth && typeof G.hgLthSthSupplyDynamics === 'function'){
          snap.lthSth = G.hgLthSthSupplyDynamics(j.lth.lthPct, j.lth.sthPct, j.lth.lth30d, j.lth.centralBankGoldSharePct);
        }
        if (j && Array.isArray(j.notes)) notes = notes.concat(j.notes);
      } else notes.push('onchain-alt API HTTP ' + r.status);
    }
  }catch(eApi){ notes.push('onchain-alt fetch failed'); }

  __snap = snap;
  __cacheAt = Date.now();
  return snap;
}

function hgOnchainAltState(){ return __snap; }

function hgOnchainAltGate(sym, dir){
  var snap = __snap;
  if (!snap) return { pass: true, state: 'na', note: 'on-chain alt not loaded' };
  dir = String(dir || '').toLowerCase();
  if (typeof G.hgNetflowGate === 'function' && snap.netflowZ){
    var nf = G.hgNetflowGate(sym, dir, snap.netflowZ);
    if (!nf.pass) return nf;
  }
  if (typeof G.hgWhaleFlowAnalysis === 'function' && snap.whaleTxs && snap.whaleTxs.length){
    var wh = G.hgWhaleFlowAnalysis(snap.whaleTxs, sym);
    if (wh.vetoDistribution && dir === 'long'){
      return { pass: false, state: 'veto', note: 'whale exchange inflow >$25M (24h) — distribution risk' };
    }
  }
  if (snap.stableCadence && snap.stableCadence.tightenRrLongs && dir === 'long'){
    return { pass: true, state: 'pass', tightenRr: 0.5, note: 'stablecoin supply contracting 14d+ — tighten R:R +0.5' };
  }
  return { pass: true, state: 'pass', note: 'on-chain alt clear' };
}

function hgStrategySharpesFromBook(bookSnap, opts){
  opts = opts || {};
  var windowDays = opts.windowDays > 0 ? opts.windowDays : 90;
  var cutoff = Date.now() - windowDays * 86400000;
  bookSnap = bookSnap || {};
  var closed = bookSnap.closed || (bookSnap.book && bookSnap.book.closed) || [];
  var byStrat = {};
  for (var i = 0; i < closed.length; i++){
    var c = closed[i];
    if (!c) continue;
    var at = c.closedAt || c.at || c.exitAt;
    if (at && +at < cutoff) continue;
    var strat = String(c.strategy || c.setupKind || 'unknown').toUpperCase();
    var fund = String(c.fund || c.fundId || 'main').toLowerCase();
    if (opts.fundId && fund !== String(opts.fundId).toLowerCase()) continue;
    var pnl = fin(c.pnl) || fin(c.pnlUsd) || 0;
    var risk = fin(c.riskUsd);
    var r = (risk && risk > 0) ? pnl / risk : (pnl !== 0 ? (pnl > 0 ? 1 : -1) : 0);
    if (!byStrat[strat]) byStrat[strat] = [];
    byStrat[strat].push(r);
  }
  var sharpes = {};
  Object.keys(byStrat).forEach(function(k){
    var rs = byStrat[k];
    if (rs.length < 5){ sharpes[k] = 0; return; }
    var mean = rs.reduce(function(a, b){ return a + b; }, 0) / rs.length;
    var sd = Math.sqrt(rs.reduce(function(a, b){ return a + Math.pow(b - mean, 2); }, 0) / rs.length);
    sharpes[k] = sd > 0 ? mean / sd : 0;
  });
  return sharpes;
}

function hgStrategySharpesDual(bookSnap, opts){
  return {
    w30: hgStrategySharpesFromBook(bookSnap, Object.assign({}, opts, { windowDays: 30 })),
    w90: hgStrategySharpesFromBook(bookSnap, Object.assign({}, opts, { windowDays: 90 }))
  };
}

function hgBookKellyStats(bookSnap, strategy, opts){
  opts = opts || {};
  var windowDays = opts.windowDays > 0 ? opts.windowDays : 90;
  var cutoff = Date.now() - windowDays * 86400000;
  bookSnap = bookSnap || {};
  var closed = bookSnap.closed || (bookSnap.book && bookSnap.book.closed) || [];
  var wins = 0, losses = 0, sumWin = 0, sumLoss = 0;
  var stratKey = String(strategy || '').toUpperCase();
  for (var i = 0; i < closed.length; i++){
    var c = closed[i];
    if (!c) continue;
    var at = c.closedAt || c.at || c.exitAt;
    if (at && +at < cutoff) continue;
    var fund = String(c.fund || c.fundId || 'main').toLowerCase();
    if (opts.fundId && fund !== String(opts.fundId).toLowerCase()) continue;
    var sk = String(c.strategy || c.setupKind || '').toUpperCase();
    if (stratKey && sk && sk !== stratKey) continue;
    var pnl = fin(c.pnl) || fin(c.pnlUsd) || 0;
    var risk = fin(c.riskUsd);
    var r = (risk && risk > 0) ? pnl / risk : (pnl > 0 ? 1 : (pnl < 0 ? -1 : 0));
    if (r > 0){ wins++; sumWin += r; }
    else if (r < 0){ losses++; sumLoss += Math.abs(r); }
  }
  var n = wins + losses;
  if (n < 5) return { winRate: 0.52, winLossRatio: 2.0, n: n, note: 'insufficient book history — defaults' };
  return {
    winRate: wins / n,
    winLossRatio: losses ? (sumWin / wins) / (sumLoss / losses) : 2.0,
    n: n,
    note: 'book-derived ' + n + ' trades (' + windowDays + 'd' + (opts.fundId ? ' · ' + opts.fundId : '') + ')'
  };
}

function hgStrategyWeightsFromBook(bookSnap, opts){
  if (typeof G.hgCalcStrategyWeights !== 'function') return {};
  var dual = hgStrategySharpesDual(bookSnap, opts);
  var merged = {};
  var keys = {};
  Object.keys(dual.w30).forEach(function(k){ keys[k] = true; });
  Object.keys(dual.w90).forEach(function(k){ keys[k] = true; });
  Object.keys(keys).forEach(function(k){
    var s30 = dual.w30[k] || 0;
    var s90 = dual.w90[k] || 0;
    merged[k] = (s30 * 0.35) + (s90 * 0.65);
  });
  var weights = G.hgCalcStrategyWeights(merged);
  try{
    G.HG_STRATEGY_WEIGHTS = weights;
    G.HG_STRATEGY_SHARPES = dual;
  }catch(e){}
  return weights;
}

function hgRegimeStrategyActive(strategy){
  if (typeof G.hgCheckStrategyRegimeActive !== 'function') return { active: true };
  var regime = 'MIXED';
  try{
    if (typeof G.regimeState === 'function'){
      var rg = G.regimeState();
      if (rg && rg.label){
        var lbl = String(rg.label).toUpperCase();
        if (lbl.indexOf('RISK-ON') >= 0) regime = 'RISK-ON';
        else if (lbl.indexOf('RISK-OFF') >= 0) regime = 'RISK-OFF';
        else if (lbl.indexOf('SELECTIVE') >= 0) regime = 'MIXED';
      } else if (rg && rg.word){
        var w = String(rg.word).toUpperCase();
        if (w.indexOf('RISK-ON') >= 0) regime = 'RISK-ON';
        else if (w.indexOf('RISK-OFF') >= 0) regime = 'RISK-OFF';
        else regime = 'MIXED';
      }
    }
  }catch(e){}
  var expMap = {};
  try{
    if (G.HG_REGIME_EXPECTANCY && typeof G.HG_REGIME_EXPECTANCY === 'object'){
      expMap = G.HG_REGIME_EXPECTANCY;
    }
  }catch(e){}
  return G.hgCheckStrategyRegimeActive(strategy, regime, expMap);
}

G.hgOnchainAltFetch = hgOnchainAltFetch;
G.hgOnchainAltState = hgOnchainAltState;
G.hgOnchainAltGate = hgOnchainAltGate;
G.hgStableContractionDays = hgStableContractionDays;
G.hgStableContractionTrack = hgStableContractionTrack;
G.hgStrategySharpesFromBook = hgStrategySharpesFromBook;
G.hgStrategySharpesDual = hgStrategySharpesDual;
G.hgBookKellyStats = hgBookKellyStats;
G.hgStrategyWeightsFromBook = hgStrategyWeightsFromBook;
G.hgRegimeStrategyActive = hgRegimeStrategyActive;

function hgInc567StrategyWeightsPanelHtml(){
  var weights = G.HG_STRATEGY_WEIGHTS;
  if ((!weights || !Object.keys(weights).length) && typeof G.hgStrategyWeightsFromBook === 'function'){
    try{
      var snap = (G.__book && G.__book.snap) ? G.__book.snap : null;
      weights = G.hgStrategyWeightsFromBook(snap);
    }catch(e){}
  }
  if (!weights || !Object.keys(weights).length){
    return '<div class="panel" style="margin-top:10px"><h2>STRATEGY ALLOCATION <span>Increment 7</span></h2><div class="note">No weights yet — close trades in BOOK or edit data/strategy-weights.json</div></div>';
  }
  var esc = function(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); };
  var sharpNote = '';
  if (G.HG_STRATEGY_SHARPES && G.HG_STRATEGY_SHARPES.w90){
    var top = Object.keys(weights).sort(function(a,b){ return (weights[b]||0)-(weights[a]||0); })[0];
    if (top && G.HG_STRATEGY_SHARPES.w90[top] != null){
      sharpNote = ' · 90d Sharpe ' + (+G.HG_STRATEGY_SHARPES.w90[top]).toFixed(2);
    }
  }
  var chips = Object.keys(weights).sort(function(a,b){ return (weights[b]||0)-(weights[a]||0); }).map(function(k){
    var w = (+weights[k] * 100).toFixed(1);
    return '<span class="gpip ok" title="Sharpe-weighted budget share">' + esc(k) + ' ' + w + '%</span>';
  }).join(' ');
  return '<div class="panel hg-strategy-weights" style="margin-top:10px"><h2>STRATEGY ALLOCATION <span>30/90d Sharpe^1.5 · floor 5% · cap 35%' + sharpNote + '</span></h2><div class="gates">' + chips + '</div></div>';
}

G.hgInc567StrategyWeightsPanelHtml = hgInc567StrategyWeightsPanelHtml;

})();
