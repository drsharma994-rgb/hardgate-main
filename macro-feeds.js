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

/* isFinite(null) is true and +null is 0, so this guard let nulls through and
   then compared them as zero: a real current reading against a null prior
   returned 'spiking', and a null current against a real prior returned
   'dropping' — an active macro call manufactured from one data point.

   Both upstream parsers (__parseYahooChart, __parseTreasury10Y) already drop
   non-finite closes, so nothing reaches this with a null today. Hardening a
   guard that was clearly meant to catch exactly this, not a live fault. */
function __yieldNum(v){ return (v === null || v === undefined || v === '') ? NaN : +v; }

function __yieldTrendBrain(cur, prior, threshold){
  threshold = (isFinite(threshold) && threshold > 0) ? threshold : 0.05;
  var c = __yieldNum(cur), p = __yieldNum(prior);
  if (!isFinite(c) || !isFinite(p)) return 'flat';
  if (c > p + threshold) return 'spiking';
  if (c < p - threshold) return 'dropping';
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

/* How long a reading stays usable after the feed stops confirming it.

   These are set by the timeframe the data is BUILT from, not by taste. The
   US10Y trend comes off daily candles, so it is still a fair read hours
   later; the SMT divergence is computed from 15m XAU/XAG bars, so it goes out
   of date within a couple of hours. Neither is valid forever. */
var YIELD_MAX_AGE_MS = 24 * 60 * 60 * 1000;
var SMT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/* A failed refresh used to publish nothing, which left the LAST GOOD state
   standing — same object, same timestamp — for as long as the feed stayed
   down. brain.js reads it and acts on it:

     trend 'spiking'  -> pushes a SHORT bias on gold, caution
     trend 'dropping' -> pushes a LONG bias on gold, strong
     divergence set   -> pushes a VETO

   So a dead US10Y feed went on biasing the gold lane short indefinitely, and
   a dead silver feed went on vetoing, with nothing on screen to say the
   reading had stopped being refreshed. brain.js already has the honest branch
   for this — `if (!inp.yield) hush('yield', 'no US10Y macro data — yield
   correlation unread')` — it simply could never be reached.

   Now a failed refresh keeps the value but marks it stale, and once it is
   older than the timeframe it was built from the state is published as null
   so that hush path is the one that fires. The diagnostic side-channel keeps
   the last known value and its age so the staleness is inspectable rather
   than merely absent. */
function __expireMacroFeedState(nowMs){
  try{
    nowMs = isFinite(nowMs) ? nowMs : Date.now();
    var y = G.__hgGoldYieldState;
    if (y && isFinite(+y.at)){
      var yAge = nowMs - (+y.at);
      if (yAge > YIELD_MAX_AGE_MS){
        G.__hgGoldYieldStale = { lastOkAt: +y.at, ageMs: yAge, last: y,
          reason: 'US10Y feed has not confirmed this reading for ' + Math.round(yAge / 3600000) + 'h' };
        G.__hgGoldYieldState = null;
        G.__hgYieldState = null;
      } else if (y.stale){
        G.__hgGoldYieldState = { trend: y.trend, current: y.current, at: y.at,
          source: y.source, stale: true, ageMs: yAge };
      }
    }
    var s = G.__hgGoldSmtState;
    if (s && isFinite(+s.at)){
      var sAge = nowMs - (+s.at);
      if (sAge > SMT_MAX_AGE_MS){
        G.__hgGoldSmtStale = { lastOkAt: +s.at, ageMs: sAge, last: s,
          reason: 'silver feed has not confirmed this divergence for ' + Math.round(sAge / 60000) + 'm' };
        G.__hgGoldSmtState = null;
        G.__hgSmtState = null;
      } else if (s.stale){
        G.__hgGoldSmtState = { divergence: s.divergence, smtActive: s.smtActive, type: s.type,
          at: s.at, source: s.source, stale: true, ageMs: sAge };
      }
    }
  }catch(e){ /* never throw */ }
}

function __publishMacroFeedState(smt, yld){
  try{
    var now = Date.now();
    if (yld && typeof yld.trend === 'string'){
      G.__hgYieldState = yld;
      G.__hgGoldYieldState = {
        trend: yld.trend,
        current: yld.current,
        at: yld.at || now,
        source: yld.source || 'macro-feeds',
        stale: false
      };
      G.__hgGoldYieldStale = null;
    } else if (G.__hgGoldYieldState){
      /* The refresh ran and produced nothing. Say so on the state itself
         rather than leaving a silent survivor. */
      G.__hgGoldYieldState.stale = true;
    }
    if (smt && typeof smt === 'object'){
      G.__hgSmtState = smt;
      G.__hgGoldSmtState = {
        divergence: smt.divergence || null,
        smtActive: !!smt.smtActive,
        type: smt.type || null,
        at: smt.at || now,
        source: smt.source || 'macro-feeds',
        stale: false
      };
      G.__hgGoldSmtStale = null;
    } else if (G.__hgGoldSmtState){
      G.__hgGoldSmtState.stale = true;
    }
    __expireMacroFeedState(now);
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
G.hgExpireMacroFeedState = __expireMacroFeedState;
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
