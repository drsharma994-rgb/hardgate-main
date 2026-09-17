/* =========================================================================
   HARDGATE Macro Feeds — Real-Time Economic Data for GOLD ULTRA

   Sources: DXY (Dollar Index), Real Yields, Economic Calendar, Geopolitical Risk
   Integration: Provides macro context for gold trading decisions
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

/* DXY strength: >105 = strong USD (bearish gold), <102 = weak USD (bullish gold) */
function hgGetDXYStrength(){
  try{
    var cached = G.__HG_MACRO_CACHE && G.__HG_MACRO_CACHE.dxyStrength;
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 300000){
      return cached.data;
    }
    var dxyMock = {
      value: 105.2,
      direction: 'STRONG',
      change1h: +0.15,
      change4h: +0.42,
      trend: 'up',
      bias: 'BEARISH_GOLD'
    };
    if (!G.__HG_MACRO_CACHE) G.__HG_MACRO_CACHE = {};
    G.__HG_MACRO_CACHE.dxyStrength = { data: dxyMock, timestamp: Date.now() };
    return dxyMock;
  }catch(e){ return { value: null, direction: 'UNKNOWN', bias: 'NEUTRAL' }; }
}

/* Real yield proxy: high real yields = gold bearish, low/negative = bullish */
function hgGetRealYieldProxy(){
  try{
    var cached = G.__HG_MACRO_CACHE && G.__HG_MACRO_CACHE.realYield;
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 600000){
      return cached.data;
    }
    var realYieldMock = {
      rate10Y: 1.85,
      inflationExpectations: 2.45,
      realYield: -0.60,
      direction: 'DOWN',
      goldBias: 'BULLISH',
      recentChange: -0.15
    };
    if (!G.__HG_MACRO_CACHE) G.__HG_MACRO_CACHE = {};
    G.__HG_MACRO_CACHE.realYield = { data: realYieldMock, timestamp: Date.now() };
    return realYieldMock;
  }catch(e){ return { realYield: null, direction: 'UNKNOWN', goldBias: 'NEUTRAL' }; }
}

/* Session liquidity context */
function hgGetSessionContext(){
  try{
    var now = new Date();
    var utcHour = now.getUTCHours();
    var context = {
      currentUTCHour: utcHour,
      session: 'QUIET',
      liquidity: 'LOW',
      volumeExpectation: 'LOW'
    };
    if (utcHour >= 0 && utcHour < 8){
      context.session = 'ASIAN';
      context.liquidity = 'LOW';
      context.volumeExpectation = 'LOW';
    } else if (utcHour >= 8 && utcHour < 12){
      context.session = 'LONDON_OPEN';
      context.liquidity = 'HIGH';
      context.volumeExpectation = 'SPIKE';
      context.tradeBias = 'MOMENTUM';
    } else if (utcHour >= 12 && utcHour < 17){
      context.session = 'LONDON';
      context.liquidity = 'HIGH';
      context.volumeExpectation = 'SUSTAINED';
      context.tradeBias = 'TREND_FOLLOW';
    } else if (utcHour >= 17 && utcHour < 21){
      context.session = 'US_OPEN';
      context.liquidity = 'VERY_HIGH';
      context.volumeExpectation = 'SUSTAINED';
      context.tradeBias = 'REVERSAL';
    } else {
      context.session = 'US_AFTER_HOURS';
      context.liquidity = 'MEDIUM';
      context.volumeExpectation = 'MEDIUM';
    }
    return context;
  }catch(e){ return { session: 'UNKNOWN', liquidity: 'UNKNOWN' }; }
}

/* Economic calendar events that affect gold */
function hgGetEconomicCalendarBias(){
  try{
    var cached = G.__HG_MACRO_CACHE && G.__HG_MACRO_CACHE.econCalendar;
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 3600000){
      return cached.data;
    }
    var economicEvents = {
      nextEvent: 'US CPI (72 hours)',
      volatilityExpectation: 'HIGH',
      impactDirection: 'AWAITING_DATA',
      cautionLevel: 2,
      recommendations: [
        'Widen stops pre-CPI',
        'Reduce size ahead of data',
        'Avoid new entries 1hr before CPI'
      ]
    };
    if (!G.__HG_MACRO_CACHE) G.__HG_MACRO_CACHE = {};
    G.__HG_MACRO_CACHE.econCalendar = { data: economicEvents, timestamp: Date.now() };
    return economicEvents;
  }catch(e){ return { volatilityExpectation: 'NORMAL', cautionLevel: 0 }; }
}

/* Geopolitical risk premium */
function hgGetGeopoliticalRisk(){
  try{
    var cached = G.__HG_MACRO_CACHE && G.__HG_MACRO_CACHE.geoRisk;
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 3600000){
      return cached.data;
    }
    var geoRisk = {
      level: 'MODERATE',
      safeHavenBias: 'GOLD_BULLISH',
      VIXproxy: 18.5,
      geopoliticalEvents: [],
      riskScore: 5.2,
      goldPremium: '+0.25%'
    };
    if (!G.__HG_MACRO_CACHE) G.__HG_MACRO_CACHE = {};
    G.__HG_MACRO_CACHE.geoRisk = { data: geoRisk, timestamp: Date.now() };
    return geoRisk;
  }catch(e){ return { level: 'UNKNOWN', safeHavenBias: 'NEUTRAL', riskScore: 0 }; }
}

/* Crypto correlation: BTC/ETH weakness signals gold strength */
function hgGetCryptoCorrelation(){
  try{
    var cached = G.__HG_MACRO_CACHE && G.__HG_MACRO_CACHE.cryptoCorr;
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 60000){
      return cached.data;
    }
    var cryptoCorr = {
      btcStrength: 'WEAK',
      btcChange24h: -2.5,
      ethStrength: 'WEAK',
      ethChange24h: -3.1,
      riskSentiment: 'RISK_OFF',
      goldSignal: 'BULLISH',
      correlation: -0.42
    };
    if (!G.__HG_MACRO_CACHE) G.__HG_MACRO_CACHE = {};
    G.__HG_MACRO_CACHE.cryptoCorr = { data: cryptoCorr, timestamp: Date.now() };
    return cryptoCorr;
  }catch(e){ return { btcStrength: 'UNKNOWN', goldSignal: 'NEUTRAL', correlation: 0 }; }
}

/* Composite macro score for entry filtering */
function hgComputeMacroScore(){
  try{
    var dxy = hgGetDXYStrength();
    var realYield = hgGetRealYieldProxy();
    var session = hgGetSessionContext();
    var crypto = hgGetCryptoCorrelation();
    var geoRisk = hgGetGeopoliticalRisk();

    var score = 0;
    if (dxy.direction === 'WEAK') score += 0.2;
    else if (dxy.direction === 'STRONG') score -= 0.2;
    if (realYield.realYield < -0.5) score += 0.25;
    else if (realYield.realYield > 0) score -= 0.15;
    if (session.liquidity === 'VERY_HIGH' || session.liquidity === 'HIGH') score += 0.15;
    if (crypto.riskSentiment === 'RISK_OFF') score += 0.2;
    if (geoRisk.level === 'ELEVATED' || geoRisk.level === 'HIGH') score += 0.15;

    score = Math.max(-1, Math.min(1, score));

    return {
      score: score,
      goldBias: score > 0.3 ? 'BULLISH' : score < -0.3 ? 'BEARISH' : 'NEUTRAL',
      confidence: Math.abs(score),
      components: { dxy, realYield, session, crypto, geoRisk }
    };
  }catch(e){ return { score: 0, goldBias: 'NEUTRAL', confidence: 0 }; }
}

G.hgGetDXYStrength = hgGetDXYStrength;
G.hgGetRealYieldProxy = hgGetRealYieldProxy;
G.hgGetSessionContext = hgGetSessionContext;
G.hgGetEconomicCalendarBias = hgGetEconomicCalendarBias;
G.hgGetGeopoliticalRisk = hgGetGeopoliticalRisk;
G.hgGetCryptoCorrelation = hgGetCryptoCorrelation;
G.hgComputeMacroScore = hgComputeMacroScore;


/* =========================================================================
   THE LIVE HALF — US10Y yield trend and gold/silver SMT divergence

   These are the two feeds brain.js acts on:

     trend 'spiking'  -> a SHORT bias on gold, caution: true
     trend 'dropping' -> a LONG bias on gold, strong: true
     divergence set   -> a VETO

   AND A DEAD FEED MUST NOT GO ON BIASING THE LANE. A failed refresh that
   publishes nothing leaves the LAST GOOD state standing — same object, same
   timestamp — for as long as the feed stays down, so a dead US10Y biases
   gold short indefinitely and a dead silver vetoes indefinitely, with
   nothing on the page to say the reading stopped being refreshed. brain.js
   already carries the honest branch (`if (!inp.yield) hush('yield', 'no
   US10Y macro data — yield correlation unread')`); it simply could never be
   reached.

   So a refresh that fails KEEPS the value and marks it stale — one bad
   fetch should not erase a good read — and an expiry withdraws it outright
   once it is too old to mean anything.

   EXPIRY FOLLOWS THE TIMEFRAME THE DATA WAS BUILT FROM, not taste. The SMT
   divergence is computed from 15m bars and is worthless within a couple of
   hours. The yield trend comes off daily candles and is still fair most of
   a day later.
   ========================================================================= */
var HG_SMT_TTL_MS   = 2 * 60 * 60 * 1000;    /* 15m bars — gone within hours */
var HG_YIELD_TTL_MS = 24 * 60 * 60 * 1000;   /* daily candles — fair for a day */
var HG_MACRO_REFRESH_MS = 5 * 60 * 1000;

/* Resolve a feed function from either global object.

   In a browser window === globalThis and this is one lookup. They are NOT
   always the same elsewhere: a classic script declaring `function
   getGoldCandles(){}` at top level puts it on globalThis without ever
   touching window, and a harness may hand the module a plain object as its
   window. Reading only one of the two is how a feed that is present reads as
   missing — which then marks a healthy reading stale. */
function __mfFn(name){
  try { if (G && typeof G[name] === 'function') return G[name]; } catch (e){}
  try {
    if (typeof globalThis !== 'undefined' && typeof globalThis[name] === 'function'){
      return globalThis[name];
    }
  } catch (e){}
  return null;
}

function __mfRows(x){
  if (!x) return null;
  if (Array.isArray(x)) return x;
  if (Array.isArray(x.rows)) return x.rows;
  return null;
}

/* A numeric reader that rejects null instead of coercing it.

   This is hardening, not a live fault, and the scope is stated rather than
   dressed up: nothing reaches the classifier with a null today.

   Both upstream parsers already drop non-finite closes, which is exactly
   why this is latent and the claim can be re-checked — macro.js's Yahoo
   reader (`if (o == null || h == null || l == null || c == null) continue;`)
   and its treasury reader (`if (!m || !isFinite(y10)) continue;`) — throw
   the row away first. But the guard here was plainly meant to catch missing
   data and did not: Number(null) is 0, so a real current against a null
   prior compared 4.22 > 0 and returned 'spiking' — an active macro call
   manufactured out of one data point. */
function __yieldNum(v){
  if (v === null || v === undefined || v === '') return NaN;
  var n = (typeof v === 'number') ? v : parseFloat(v);
  return isFinite(n) ? n : NaN;
}

function __mfYieldTrend(cur, prior){
  var c = __yieldNum(cur), p = __yieldNum(prior);
  if (!isFinite(c) || !isFinite(p)) return null;
  if (c > p) return 'spiking';
  if (c < p) return 'dropping';
  return 'flat';
}

/* US10Y, from whatever daily series the page has. Returns null when the feed
   cannot answer — the caller decides what to do with that, and what it does
   is mark the old reading stale rather than quietly keep serving it. */
function fetchUS10YYield(){
  return Promise.resolve()
    .then(function(){
      var fn = __mfFn('getUST10YCandles');
      return fn ? fn() : null;
    })
    .then(function(raw){
      var rows = __mfRows(raw);
      if (!rows || rows.length < 5) return null;
      var last = rows[rows.length - 1], back = rows[rows.length - 5];
      var trend = __mfYieldTrend(last && last.c, back && back.c);
      if (!trend) return null;
      var cur = __yieldNum(last && last.c);
      return { trend: trend, current: isFinite(cur) ? cur : null };
    })
    .catch(function(){ return null; });
}

/* Gold/silver SMT. The divergence itself is goldind.js's detectSMTDivergence
   — one implementation, called here rather than copied, so this feed cannot
   drift from the detector the gold desk shows. */
function fetchSilverData(){
  return Promise.resolve()
    .then(function(){
      var g = __mfFn('getGoldCandles'), sv = __mfFn('getSilverCandles');
      if (!g || !sv) return null;
      return Promise.all([g(), sv()]);
    })
    .then(function(pair){
      if (!pair) return null;
      var xau = __mfRows(pair[0]), xag = __mfRows(pair[1]);
      if (!xau || !xag || !xau.length || !xag.length) return null;
      var det = __mfFn('detectSMTDivergence');
      if (!det) return null;
      var smt = det(xau, xag);
      if (!smt) return null;
      /* the same mapping goldind's own brain publisher uses */
      var divergence = smt.smtActive
        ? (smt.type === 'BEARISH_SMT' ? 'BEARISH' : 'BULLISH')
        : null;
      return { smtActive: !!smt.smtActive, type: smt.type || null,
               signal: smt.signal || null, divergence: divergence };
    })
    .catch(function(){ return null; });
}

function __mfPublishYield(v){
  var now = Date.now();
  if (v){
    G.__hgGoldYieldState = { trend: v.trend, current: v.current, stale: false,
                             at: now, source: 'macro-feeds' };
    G.__hgGoldYieldStale = null;
  } else if (G.__hgGoldYieldState){
    /* keep the value, change only its status — one failure is not a reason
       to erase a good read, and its `at` must NOT move or it would never age */
    G.__hgGoldYieldState.stale = true;
  }
  G.__hgYieldState = G.__hgGoldYieldState || null;
  return G.__hgGoldYieldState;
}

function __mfPublishSmt(v){
  var now = Date.now();
  if (v){
    G.__hgGoldSmtState = { smtActive: v.smtActive, divergence: v.divergence,
                           type: v.type, signal: v.signal, stale: false,
                           at: now, source: 'macro-feeds' };
    G.__hgGoldSmtStale = null;
  } else if (G.__hgGoldSmtState){
    G.__hgGoldSmtState.stale = true;
  }
  G.__hgSmtState = G.__hgGoldSmtState || null;
  return G.__hgGoldSmtState;
}

/* Withdraw a reading that is past the life of the bars it was built from.
   Takes `nowMs` so staleness is testable without waiting for a clock. */
function hgExpireMacroFeedState(nowMs){
  var now = isFinite(nowMs) ? nowMs : Date.now();
  var y = G.__hgGoldYieldState, s = G.__hgGoldSmtState;
  if (y && isFinite(y.at) && (now - y.at) > HG_YIELD_TTL_MS){
    G.__hgGoldYieldStale = {
      reason: 'the US10Y feed has not confirmed this reading for over '
            + Math.round(HG_YIELD_TTL_MS / 3600000) + 'h',
      since: y.at, last: y
    };
    G.__hgGoldYieldState = null;
    G.__hgYieldState = null;
  }
  if (s && isFinite(s.at) && (now - s.at) > HG_SMT_TTL_MS){
    G.__hgGoldSmtStale = {
      reason: 'the silver feed has not confirmed this divergence for over '
            + Math.round(HG_SMT_TTL_MS / 3600000) + 'h',
      since: s.at, last: s
    };
    G.__hgGoldSmtState = null;
    G.__hgSmtState = null;
  }
  return { yield: G.__hgGoldYieldState, smt: G.__hgGoldSmtState };
}

function updateMacroFeeds(){
  return Promise.all([fetchUS10YYield(), fetchSilverData()])
    .then(function(r){
      var y = __mfPublishYield(r[0]);
      var s = __mfPublishSmt(r[1]);
      hgExpireMacroFeedState(Date.now());
      return { yield: y, smt: s };
    })
    .catch(function(){
      __mfPublishYield(null);
      __mfPublishSmt(null);
      return { yield: G.__hgGoldYieldState, smt: G.__hgGoldSmtState };
    });
}

var __mfTimer = null;
function startMacroFeeds(){
  if (__mfTimer) return __mfTimer;
  var si = __mfFn('setInterval');
  if (!si) return null;
  __mfTimer = si(function(){
    try { updateMacroFeeds(); } catch (e){}
  }, HG_MACRO_REFRESH_MS);
  return __mfTimer;
}
function stopMacroFeeds(){
  var ci = __mfFn('clearInterval');
  if (__mfTimer && ci){ try { ci(__mfTimer); } catch (e){} }
  __mfTimer = null;
}

G.fetchUS10YYield        = fetchUS10YYield;
G.fetchSilverData        = fetchSilverData;
G.updateMacroFeeds       = updateMacroFeeds;
G.hgExpireMacroFeedState = hgExpireMacroFeedState;
G.startMacroFeeds        = startMacroFeeds;
G.stopMacroFeeds         = stopMacroFeeds;

/* armed at load, so a page that never calls it still refreshes. The flag is
   the seam a test uses to keep the loop out of its way. */
if (!G.__hgMacroFeedsNoAuto){
  try { startMacroFeeds(); } catch (e){}
}
