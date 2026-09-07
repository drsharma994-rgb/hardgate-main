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
        if (typeof G.hgDetectTetherPrint === 'function' && fin(st.usdtUSD)){
          snap.tetherPrint = G.hgDetectTetherPrint(st.usdtMint24h || null);
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
        if (j && j.lth && typeof G.hgLthSthSupplyDynamics === 'function'){
          snap.lthSth = G.hgLthSthSupplyDynamics(j.lth.lthPct, j.lth.sthPct, j.lth.lth30d, null);
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

function hgStrategySharpesFromBook(bookSnap){
  bookSnap = bookSnap || {};
  var closed = bookSnap.closed || (bookSnap.book && bookSnap.book.closed) || [];
  var byStrat = {};
  for (var i = 0; i < closed.length; i++){
    var c = closed[i];
    if (!c) continue;
    var strat = String(c.strategy || c.setupKind || 'unknown').toUpperCase();
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

function hgStrategyWeightsFromBook(bookSnap){
  if (typeof G.hgCalcStrategyWeights !== 'function') return {};
  return G.hgCalcStrategyWeights(hgStrategySharpesFromBook(bookSnap));
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
G.hgStrategySharpesFromBook = hgStrategySharpesFromBook;
G.hgStrategyWeightsFromBook = hgStrategyWeightsFromBook;
G.hgRegimeStrategyActive = hgRegimeStrategyActive;

})();
