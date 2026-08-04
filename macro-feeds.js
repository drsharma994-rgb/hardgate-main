/* =========================================================================
HARDGATE — macro-feeds.js
Background Silver (XAG) + US10Y yield feeds for the BRAIN gold lane.

Publishes window.__hgGoldYieldState / __hgGoldSmtState (and __hgYieldState /
__hgSmtState aliases) that brain.js reads via hgYieldState() / hgSmtState().

Data sources (never mocked):
  XAU 15m — macro.js getGoldCandles (Binance XAU/PAXG -> TD -> Yahoo GC=F)
  XAG 15m — macro.js getSilverCandles (Binance XAG -> TD -> Yahoo SI=F)
  US10Y   — macro.js getUST10YCandles / getUST10Y / getGoldMacro fallbacks

Discipline: never throw, no console.error spam, fire-and-forget refresh loop.
Loads after goldind.js (detectSMTDivergence) and before brain.js.
========================================================================= */
(function(){
'use strict';

var G = (typeof window !== 'undefined') ? window : null;
if (!G) return;

var FEED_MS = 5 * 60 * 1000;
var __feedTimer = null;

function __yieldTrendBrain(cur, prior, threshold){
  threshold = (isFinite(threshold) && threshold > 0) ? threshold : 0.05;
  if (!isFinite(cur) || !isFinite(prior)) return 'flat';
  if (cur > prior + threshold) return 'spiking';
  if (cur < prior - threshold) return 'dropping';
  return 'flat';
}

function __mapSmtForBrain(smtResult){
  var base = { divergence: null, smtActive: false, type: null, at: Date.now() };
  if (!smtResult || !smtResult.smtActive) return base;
  return {
    divergence: smtResult.type === 'BEARISH_SMT' ? 'BEARISH' : 'BULLISH',
    smtActive: true,
    type: smtResult.type || null,
    signal: smtResult.signal || null,
    at: Date.now()
  };
}

function __publishMacroFeedState(smt, yld){
  try{
    if (yld && typeof yld.trend === 'string'){
      G.__hgYieldState = yld;
      G.__hgGoldYieldState = {
        trend: yld.trend,
        current: yld.current,
        at: yld.at || Date.now(),
        source: yld.source || 'macro-feeds'
      };
    }
    if (smt && typeof smt === 'object'){
      G.__hgSmtState = smt;
      G.__hgGoldSmtState = {
        divergence: smt.divergence || null,
        smtActive: !!smt.smtActive,
        type: smt.type || null,
        at: smt.at || Date.now(),
        source: smt.source || 'macro-feeds'
      };
    }
  }catch(e){ /* never throw */ }
}

async function fetchSilverData(){
  try{
    var xau = null, xag = null, src = 'macro-feeds';
    if (typeof getGoldCandles === 'function'){
      var xauOut = await getGoldCandles('15m', 50);
      if (xauOut && xauOut.rows && xauOut.rows.length){
        xau = xauOut.rows;
        src = xauOut.source || src;
      }
    }
    if (!xau && typeof G.getXAUCandles === 'function'){
      try{
        xau = await G.getXAUCandles('15m', 50);
        src = 'xau-router';
      }catch(e){}
    }
    if (typeof getSilverCandles === 'function'){
      var xagOut = await getSilverCandles('15m', 50);
      if (xagOut && xagOut.rows && xagOut.rows.length) xag = xagOut.rows;
    }
    if (!xau || !xag || xau.length < 16 || xag.length < 16) return null;

    G.__hgXauCandles = xau;
    G.__hgXagCandles = xag;

    var detect = (typeof G.detectSMTDivergence === 'function') ? G.detectSMTDivergence
               : (typeof G.goldSMTDivergence === 'function') ? G.goldSMTDivergence : null;
    if (!detect) return null;

    var idx = Math.min(xau.length, xag.length) - 1;
    var smtResult = detect(xau, xag, idx, 15);
    var out = __mapSmtForBrain(smtResult);
    out.source = src;
    return out;
  }catch(e){ return null; }
}

async function fetchUS10YYield(){
  try{
    if (typeof getUST10YCandles === 'function'){
      var candles = await getUST10YCandles(10);
      if (candles && candles.length >= 5){
        var cur = candles[candles.length - 1].c;
        var prior = candles[candles.length - 5].c;
        G.__hgUs10yCandles = candles;
        return {
          current: cur,
          trend: __yieldTrendBrain(cur, prior, 0.05),
          at: Date.now(),
          source: 'ust10y-candles'
        };
      }
    }
    if (typeof getUST10Y === 'function'){
      var ust = await getUST10Y();
      if (ust && isFinite(ust.value)){
        var trend = ust.trend20 === 'RISING' ? 'spiking'
          : (ust.trend20 === 'FALLING' ? 'dropping' : 'flat');
        return {
          current: ust.value,
          trend: trend,
          at: Date.now(),
          source: ust.source || 'ust10y'
        };
      }
    }
    if (typeof getGoldMacro === 'function'){
      var m = await getGoldMacro();
      if (m && isFinite(m.tnx)){
        var t2 = m.tnxTrend === 'RISING' ? 'spiking'
          : (m.tnxTrend === 'FALLING' ? 'dropping' : 'flat');
        return { current: m.tnx, trend: t2, at: Date.now(), source: 'gold-macro' };
      }
    }
    return null;
  }catch(e){ return null; }
}

async function updateMacroFeeds(){
  try{
    var smt = await fetchSilverData();
    var yld = await fetchUS10YYield();
    __publishMacroFeedState(smt, yld);
    return { smt: smt, yield: yld, at: Date.now() };
  }catch(e){ return null; }
}

function startMacroFeeds(intervalMs){
  intervalMs = (isFinite(+intervalMs) && +intervalMs > 0) ? +intervalMs : FEED_MS;
  if (__feedTimer) clearInterval(__feedTimer);
  try{ updateMacroFeeds(); }catch(e){}
  __feedTimer = setInterval(function(){
    try{ updateMacroFeeds(); }catch(e){}
  }, intervalMs);
}

function stopMacroFeeds(){
  if (__feedTimer){
    clearInterval(__feedTimer);
    __feedTimer = null;
  }
}

G.fetchSilverData = fetchSilverData;
G.fetchUS10YYield = fetchUS10YYield;
G.updateMacroFeeds = updateMacroFeeds;
G.startMacroFeeds = startMacroFeeds;
G.stopMacroFeeds = stopMacroFeeds;
G.HG_warmups = G.HG_warmups || [];
G.HG_warmups.push({ id: 'macro', label: 'MACRO FEEDS', run: function(){
  return updateMacroFeeds().then(function(){ return 'warmed'; }).catch(function(){ return 'unavailable'; });
}});

if (!G.__hgMacroFeedsNoAuto){
  if (G.document && G.document.readyState === 'loading'){
    G.document.addEventListener('DOMContentLoaded', function(){ startMacroFeeds(); });
  }else{
    startMacroFeeds();
  }
}

})();
