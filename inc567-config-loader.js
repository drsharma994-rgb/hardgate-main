/* HARDGATE — inc567-config-loader.js
   Loads Increment 7 JSON configs: strategy weights, regime expectancy, fund mandates. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
var __loaded = false;

async function hgInc567LoadConfigs(force){
  if (__loaded && !force) return { ok: true, cached: true };
  var out = { ok: true, weights: null, expectancy: null, funds: null, notes: [] };
  try{
    if (typeof fetch !== 'function'){ out.notes.push('no fetch'); return out; }
    var base = './data/';
    var r1 = await fetch(base + 'strategy-weights.json', { cache: 'no-store' });
    if (r1.ok){
      var w = await r1.json();
      G.HG_STRATEGY_WEIGHTS = w.weights || w;
      out.weights = G.HG_STRATEGY_WEIGHTS;
    } else out.notes.push('strategy-weights.json missing');
    var r2 = await fetch(base + 'strategy-regime-state.json', { cache: 'no-store' });
    if (r2.ok){
      var rg = await r2.json();
      G.HG_REGIME_EXPECTANCY = rg.expectancy || rg;
      out.expectancy = G.HG_REGIME_EXPECTANCY;
    } else out.notes.push('strategy-regime-state.json missing');
    var r3 = await fetch(base + 'fund-config.json', { cache: 'no-store' });
    if (r3.ok){
      G.HG_FUND_CONFIG = await r3.json();
      out.funds = G.HG_FUND_CONFIG;
    } else out.notes.push('fund-config.json missing');
    __loaded = true;
  }catch(e){ out.ok = false; out.notes.push(String(e && e.message || e)); }
  return out;
}

function hgInc567StrategyWeight(strategy){
  var w = G.HG_STRATEGY_WEIGHTS;
  if (!w || typeof w !== 'object') return null;
  var k = String(strategy || '').toUpperCase();
  return w[k] != null ? +w[k] : null;
}

function hgInc567FundConfig(fundId){
  var fc = G.HG_FUND_CONFIG;
  if (!fc || !Array.isArray(fc.funds)) return null;
  fundId = String(fundId || 'main').toLowerCase();
  for (var i = 0; i < fc.funds.length; i++){
    if (fc.funds[i] && String(fc.funds[i].id || '').toLowerCase() === fundId) return fc.funds[i];
  }
  return null;
}

G.hgInc567LoadConfigs = hgInc567LoadConfigs;
G.hgInc567StrategyWeight = hgInc567StrategyWeight;
G.hgInc567FundConfig = hgInc567FundConfig;

try{
  if (G.document){
    var boot = function(){ hgInc567LoadConfigs(); };
    if (G.document.readyState === 'loading') G.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
}catch(e){}
})();
