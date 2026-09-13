/* =========================================================================
   HARDGATE Session Volume Profile — Point of Control & Session Analysis

   Identifies where institutional volume is concentrated (POC), VAL/VAH zones
   Integration: Session liquidity context for GOLD ULTRA entries
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

/* Session volume profile: accumulate volume at price levels */
function hgBuildVolumeProfile(candles, sessionStart, sessionEnd){
  if (!candles || candles.length < 10) return null;
  try{
    var profile = {};
    var totalVolume = 0;

    for (var i = 0; i < candles.length; i++){
      var c = candles[i];
      var timestamp = c.time || (c.ts * 1000);

      /* Only candles in session window */
      if (timestamp < sessionStart || timestamp > sessionEnd) continue;

      var priceLevel = Math.round(c.close * 100) / 100;
      if (!profile[priceLevel]) profile[priceLevel] = 0;
      profile[priceLevel] += (c.volume || 0);
      totalVolume += (c.volume || 0);
    }

    return { profile: profile, totalVolume: totalVolume };
  }catch(e){ return null; }
}

/* Point of control: price level with most volume */
function hgFindPOC(volumeProfile){
  if (!volumeProfile || !volumeProfile.profile) return null;
  try{
    var maxVolume = 0;
    var pocPrice = null;

    for (var price in volumeProfile.profile){
      if (volumeProfile.profile[price] > maxVolume){
        maxVolume = volumeProfile.profile[price];
        pocPrice = parseFloat(price);
      }
    }

    return {
      poc: pocPrice,
      pocVolume: maxVolume,
      volumePercentage: (maxVolume / volumeProfile.totalVolume * 100).toFixed(1) + '%',
      significance: maxVolume > volumeProfile.totalVolume * 0.15 ? 'HIGH' : 'NORMAL'
    };
  }catch(e){ return null; }
}

/* Value Area: price range containing 70% of session volume */
function hgFindValueArea(volumeProfile){
  if (!volumeProfile || !volumeProfile.profile) return null;
  try{
    var prices = Object.keys(volumeProfile.profile).map(parseFloat).sort(function(a,b){ return a - b; });
    var cumVolume = 0;
    var targetVolume = volumeProfile.totalVolume * 0.70;
    var valueAreaPrices = [];

    /* Find middle price with most volume, expand outward */
    var startIdx = Math.floor(prices.length / 2);
    for (var i = startIdx; i < prices.length && cumVolume < targetVolume; i++){
      valueAreaPrices.push(prices[i]);
      cumVolume += volumeProfile.profile[prices[i]];
    }

    valueAreaPrices.sort(function(a,b){ return a - b; });
    var val = valueAreaPrices[0];
    var vah = valueAreaPrices[valueAreaPrices.length - 1];

    return {
      val: val,
      vah: vah,
      width: vah - val,
      volumeEnclosed: cumVolume,
      poc: (val + vah) / 2
    };
  }catch(e){ return null; }
}

/* Session context: which trading session are we in (by UTC hour) */
function hgGetCurrentSessionWindow(){
  try{
    var now = new Date();
    var utcHour = now.getUTCHours();
    var startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    var sessions = [
      { name: 'ASIAN', startUTC: 0, endUTC: 8 },
      { name: 'LONDON_OPEN', startUTC: 8, endUTC: 12 },
      { name: 'LONDON', startUTC: 12, endUTC: 17 },
      { name: 'US_OPEN', startUTC: 17, endUTC: 21 },
      { name: 'US_AFTER_HOURS', startUTC: 21, endUTC: 24 }
    ];

    var currentSession = null;
    for (var i = 0; i < sessions.length; i++){
      var s = sessions[i];
      if (utcHour >= s.startUTC && utcHour < s.endUTC){
        currentSession = s;
        break;
      }
    }

    var sessionStart = new Date(startOfDay);
    sessionStart.setUTCHours(currentSession.startUTC, 0, 0, 0);
    var sessionEnd = new Date(startOfDay);
    sessionEnd.setUTCHours(currentSession.endUTC, 0, 0, 0);

    return {
      session: currentSession.name,
      startTime: sessionStart.getTime(),
      endTime: sessionEnd.getTime(),
      minutesElapsed: Math.round((now - sessionStart) / 60000),
      liquidity: currentSession.name === 'US_OPEN' ? 'PEAK' : currentSession.name.includes('LONDON') ? 'HIGH' : 'MODERATE'
    };
  }catch(e){
    return { session: 'UNKNOWN', liquidity: 'UNKNOWN' };
  }
}

/* Session analysis: POC + VAL/VAH + open/close pivots */
function hgAnalyzeSessionVolume(candles){
  if (!candles || candles.length < 10){
    return { sessionAnalysis: null, confidence: 0 };
  }
  try{
    var sessionWindow = hgGetCurrentSessionWindow();
    var volumeProfile = hgBuildVolumeProfile(candles, sessionWindow.startTime, sessionWindow.endTime);

    if (!volumeProfile || !volumeProfile.profile){
      return { sessionAnalysis: null, confidence: 0 };
    }

    var poc = hgFindPOC(volumeProfile);
    var valueArea = hgFindValueArea(volumeProfile);

    var sessionOpen = candles[0] && candles[0].open;
    var sessionClose = candles[candles.length - 1] && candles[candles.length - 1].close;

    return {
      session: sessionWindow.session,
      poc: poc,
      valueArea: valueArea,
      sessionOpen: sessionOpen,
      sessionClose: sessionClose,
      direction: sessionClose > sessionOpen ? 'UP' : 'DOWN',
      totalSessionVolume: volumeProfile.totalVolume,
      liquidityProfile: sessionWindow.liquidity,
      confidence: Math.min(0.95, (volumeProfile.totalVolume / 1000000) * 0.1)
    };
  }catch(e){
    return { sessionAnalysis: null, confidence: 0 };
  }
}

G.hgBuildVolumeProfile = hgBuildVolumeProfile;
G.hgFindPOC = hgFindPOC;
G.hgFindValueArea = hgFindValueArea;
G.hgGetCurrentSessionWindow = hgGetCurrentSessionWindow;
G.hgAnalyzeSessionVolume = hgAnalyzeSessionVolume;
