/* =========================================================================
   HARDGATE Session Volume Profile — Point of Control & Session Analysis

   Identifies where institutional volume is concentrated (POC), VAL/VAH zones
   Integration: Session liquidity context for GOLD ULTRA entries

   hg-v1008: and the PARTICIPATION FLOOR read, hgSessionVolPct — where a
   bar's volume sits inside the distribution of ITS OWN session's bars over
   the loaded tape. The profile functions above take chart candles
   (c.time/c.close/c.volume); the floor read takes the house row shape
   ({t,o,h,l,c,v}, t in seconds or ms). Two shapes, one module, stated
   plainly so nobody feeds one into the other.
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

/* hg-v1008: the session list, hoisted to one home — hgGetCurrentSessionWindow
   reads it for "which session is NOW", hgSessionVolPct buckets history with
   it. Two copies would drift the first time either was re-drawn. */
var HG_SV_SESSIONS = [
  { name: 'ASIAN', startUTC: 0, endUTC: 8 },
  { name: 'LONDON_OPEN', startUTC: 8, endUTC: 12 },
  { name: 'LONDON', startUTC: 12, endUTC: 17 },
  { name: 'US_OPEN', startUTC: 17, endUTC: 21 },
  { name: 'US_AFTER_HOURS', startUTC: 21, endUTC: 24 }
];
function __svSessionOf(utcHour){
  for (var i = 0; i < HG_SV_SESSIONS.length; i++){
    var s = HG_SV_SESSIONS[i];
    if (utcHour >= s.startUTC && utcHour < s.endUTC) return s.name;
  }
  return 'UNKNOWN';
}

/* Session volume profile: accumulate volume at price levels */
function hgBuildVolumeProfile(candles, sessionStart, sessionEnd){
  if (!candles || candles.length < 10) return null;
  try{
    var profile = {};
    var totalVolume = 0;

    for (var i = 0; i < candles.length; i++){
      var c = candles[i];
      var rawT = (c.time != null) ? c.time : (c.ts != null ? c.ts : null);
      var timestamp = (rawT != null && rawT < 1e12) ? rawT * 1000 : rawT;
      if (timestamp == null) continue;

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

    /* Start at the POC (max volume) and expand outward, taking the heavier
       side first, until 70% of the session volume is enclosed. The old walk
       started at the mid-price and moved up only, so VAL was always the
       middle price and the lower half of the profile was never included. */
    var pocIdx = 0, maxVol = -1, p;
    for (p = 0; p < prices.length; p++){
      if (volumeProfile.profile[prices[p]] > maxVol){ maxVol = volumeProfile.profile[prices[p]]; pocIdx = p; }
    }
    var pocPrice = prices[pocIdx];
    valueAreaPrices.push(pocPrice);
    cumVolume += volumeProfile.profile[pocPrice];
    var lo = pocIdx - 1, hi = pocIdx + 1;
    while (cumVolume < targetVolume && (lo >= 0 || hi < prices.length)){
      var volLo = lo >= 0 ? volumeProfile.profile[prices[lo]] : -1;
      var volHi = hi < prices.length ? volumeProfile.profile[prices[hi]] : -1;
      if (volLo >= volHi && lo >= 0){
        valueAreaPrices.push(prices[lo]); cumVolume += volLo; lo--;
      } else if (hi < prices.length){
        valueAreaPrices.push(prices[hi]); cumVolume += volHi; hi++;
      } else break;
    }

    valueAreaPrices.sort(function(a,b){ return a - b; });
    var val = valueAreaPrices[0];
    var vah = valueAreaPrices[valueAreaPrices.length - 1];

    return {
      val: val,
      vah: vah,
      width: vah - val,
      volumeEnclosed: cumVolume,
      poc: pocPrice
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

    var sessions = HG_SV_SESSIONS;   /* hg-v1008: the one home, hoisted at module scope */

    var currentSession = null;
    for (var i = 0; i < sessions.length; i++){
      var s = sessions[i];
      if (utcHour >= s.startUTC && utcHour < s.endUTC){
        currentSession = s;
        break;
      }
    }
    if (!currentSession) return { session: 'UNKNOWN', liquidity: 'UNKNOWN' };

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

    /* open/close pivots must come from the SESSION window, not the whole tape */
    var sessionCandles = [];
    for (var si = 0; si < candles.length; si++){
      var sc = candles[si];
      var sT = (sc.time != null) ? sc.time : (sc.ts != null ? sc.ts : null);
      var sMs = (sT != null && sT < 1e12) ? sT * 1000 : sT;
      if (sMs != null && sMs >= sessionWindow.startTime && sMs <= sessionWindow.endTime) sessionCandles.push(sc);
    }
    var sessionOpen = sessionCandles.length ? sessionCandles[0].open : null;
    var sessionClose = sessionCandles.length ? sessionCandles[sessionCandles.length - 1].close : null;

    return {
      session: sessionWindow.session,
      poc: poc,
      valueArea: valueArea,
      sessionOpen: sessionOpen,
      sessionClose: sessionClose,
      direction: (sessionOpen != null && sessionClose != null)
        ? (sessionClose > sessionOpen ? 'UP' : (sessionClose < sessionOpen ? 'DOWN' : 'FLAT'))
        : 'UNKNOWN',
      totalSessionVolume: volumeProfile.totalVolume,
      liquidityProfile: sessionWindow.liquidity,
      confidence: Math.min(0.95, (volumeProfile.totalVolume / 1000000) * 0.1)
    };
  }catch(e){
    return { sessionAnalysis: null, confidence: 0 };
  }
}

/* hg-v1008: THE PARTICIPATION FLOOR READ.

   hgSessionVolPct(rows, tMs) — where the named bar's volume sits inside the
   distribution of ITS OWN session's bars across the loaded tape, 0..100 by
   the house's strict-below convention (the share of same-session bars that
   carried LESS volume). A 100-tick bar is dead at 17:00 UTC and normal at
   03:00 UTC; only the session-relative read knows the difference, which is
   why the bucketing is this module's own session list and not the clock
   alone.

   The bar the instant names: the latest bar that had OPENED by tMs. A
   bar-open stamp (the desks' signalT) lands on its own bar; a wall-clock
   stamp lands on the bar then forming; an instant before the tape is
   unreadable. Exact-equality matching would silently miss every wall-clock
   stamp and fabricate nothing — this rule misses nothing and fabricates
   nothing.

   HONEST NULLS, never a fabricated percentile:
     - junk or thin tapes (< 30 bars), an unreadable instant, or the bar
       not on the tape -> null
     - fewer than 20 OTHER same-session bars with a readable volume -> null
       (a percentile on a handful of samples is a guess wearing a number)
     - a session whose volumes never vary (min === max — a feed printing
       one repeated figure, all-zero included) -> null: no information,
       the hg-v1006 constant-volume UNCHECKED rule
   The caller treats null as "the floor cannot speak", never as failure. */
function hgSessionVolPct(rows, tMs){
  try{
    if (!Array.isArray(rows) || rows.length < 30) return null;
    var q = (tMs === null || tMs === undefined || tMs === '') ? NaN : +tMs;
    if (!isFinite(q)) return null;
    if (q > 0 && q < 1e12) q = q * 1000;   /* seconds -> ms, the house convention */
    var qi = -1, i;
    for (i = rows.length - 1; i >= 0; i--){
      var bt = rows[i] && +rows[i].t;
      if (!isFinite(bt)) continue;
      if ((bt > 1e12 ? bt : bt * 1000) <= q){ qi = i; break; }
    }
    if (qi < 0) return null;
    var qv = +rows[qi].v;
    if (!isFinite(qv)) return null;
    var qSess = __svSessionOf(new Date(+rows[qi].t > 1e12 ? +rows[qi].t : +rows[qi].t * 1000).getUTCHours());
    var dist = [];
    for (i = 0; i < rows.length; i++){
      if (i === qi) continue;
      var v = +rows[i].v, t2 = +rows[i].t;
      if (!isFinite(v) || !isFinite(t2)) continue;
      var ms2 = t2 > 1e12 ? t2 : t2 * 1000;
      if (__svSessionOf(new Date(ms2).getUTCHours()) !== qSess) continue;
      dist.push(v);
    }
    if (dist.length < 20) return null;
    var mn = Infinity, mx = -Infinity;
    for (i = 0; i < dist.length; i++){ if (dist[i] < mn) mn = dist[i]; if (dist[i] > mx) mx = dist[i]; }
    if (!(mx > mn)) return null;
    var below = 0;
    for (i = 0; i < dist.length; i++){ if (dist[i] < qv) below++; }
    return { pct: 100 * below / dist.length, session: qSess, n: dist.length, v: qv };
  }catch(e){ return null; }
}

G.hgSessionVolPct = hgSessionVolPct;
G.hgBuildVolumeProfile = hgBuildVolumeProfile;
G.hgFindPOC = hgFindPOC;
G.hgFindValueArea = hgFindValueArea;
G.hgGetCurrentSessionWindow = hgGetCurrentSessionWindow;
G.hgAnalyzeSessionVolume = hgAnalyzeSessionVolume;
