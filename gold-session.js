/* HARDGATE — gold-session.js
   DST-aware London/NY session helpers shared by goldKillzone, GOLD tab scalp
   windows, London Fix / NY Close, and Silver-Bullet boosts. Uses Intl so BST
   and EDT shift automatically — do not hardcode UTC offsets here. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function __toMs(d){
  if (d == null) return Date.now();
  if (typeof d === 'number' && isFinite(d)) return d < 1e12 ? d * 1000 : d;
  var t = new Date(d).getTime();
  return isFinite(t) ? t : Date.now();
}

/** Fractional local hour in `tz` at `ms` (DST-correct via Intl). */
function hgTzHour(ms, tz){
  try{
    var f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    var parts = f.formatToParts(new Date(ms)), h = NaN, m = NaN, i;
    for (i = 0; i < parts.length; i++){
      if (parts[i].type === 'hour') h = +parts[i].value;
      if (parts[i].type === 'minute') m = +parts[i].value;
    }
    if (h === 24) h = 0;
    return h + m / 60;
  }catch(e){
    var d = new Date(ms);
    return d.getUTCHours() + d.getUTCMinutes() / 60;
  }
}

/** ICT killzone stamp — same shape as goldKillzone(). */
function hgGoldKillzoneRead(d){
  var out = { zone: 'OFF', weight: 0, hourGMT: NaN, label: 'OFF-HOURS' };
  try{
    var ms = __toMs(d);
    var lon = hgTzHour(ms, 'Europe/London');
    var ny = hgTzHour(ms, 'America/New_York');
    var utc = new Date(ms).getUTCHours() + new Date(ms).getUTCMinutes() / 60;
    out.hourGMT = Math.floor(utc);
    if (lon >= 13 && lon < 17 && ny >= 8.5 && ny < 16){
      out.zone = 'OVERLAP'; out.weight = 3; out.label = 'LONDON/NY OVERLAP';
    } else if (lon >= 7 && lon < 10){
      out.zone = 'LONDON'; out.weight = 2; out.label = 'LONDON KILLZONE';
    } else if (ny >= 10 && ny < 13){
      out.zone = 'NY_AM'; out.weight = 1; out.label = 'NY AM';
    } else if (utc >= 0 && utc < 8){
      out.zone = 'ASIAN'; out.weight = 0; out.label = 'ASIAN RANGE';
    }
    return out;
  }catch(e){ return out; }
}

/** Scalp kill-zone read for the GOLD tab (London 07–10 local, NY 12–15 local). */
function hgGoldScalpSession(d){
  try{
    var ms = __toMs(d);
    var lon = hgTzHour(ms, 'Europe/London');
    var ny = hgTzHour(ms, 'America/New_York');
    var utc = new Date(ms).getUTCHours() + new Date(ms).getUTCMinutes() / 60;
    if (lon >= 7 && lon < 10) return { name: 'LONDON KZ', kz: true };
    if (ny >= 12 && ny < 15) return { name: 'NY KZ', kz: true };
    if (utc >= 0 && utc < 7) return { name: 'ASIA (range builds)', kz: false };
    return { name: 'OFF-SESSION', kz: false };
  }catch(e){ return { name: 'OFF-SESSION', kz: false }; }
}

/** London PM fix window — 15:00–15:30 Europe/London local. */
function hgIsLondonFix(d){
  try{
    var lon = hgTzHour(__toMs(d), 'Europe/London');
    return lon >= 15 && lon <= 15.5;
  }catch(e){ return false; }
}

/** NY cash close window — 16:00–16:30 America/New_York local. */
function hgIsNYClose(d){
  try{
    var ny = hgTzHour(__toMs(d), 'America/New_York');
    return ny >= 16 && ny <= 16.5;
  }catch(e){ return false; }
}

/** Silver-Bullet / ICT hour boost (London 10–11 & NY 10–11 local). */
function hgGoldSilverBulletBoost(nowMs){
  try{
    var ms = __toMs(nowMs);
    var lon = hgTzHour(ms, 'Europe/London');
    var ny = hgTzHour(ms, 'America/New_York');
    return {
      inLondon: lon >= 10 && lon < 11,
      inNy: ny >= 10 && ny < 11,
      inOverlap: lon >= 13 && lon < 17
    };
  }catch(e){ return { inLondon: false, inNy: false, inOverlap: false }; }
}

G.hgTzHour = hgTzHour;
G.hgGoldKillzoneRead = hgGoldKillzoneRead;
G.hgGoldScalpSession = hgGoldScalpSession;
G.hgIsLondonFix = hgIsLondonFix;
G.hgIsNYClose = hgIsNYClose;
G.hgGoldSilverBulletBoost = hgGoldSilverBulletBoost;
})();
