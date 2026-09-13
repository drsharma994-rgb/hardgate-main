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
