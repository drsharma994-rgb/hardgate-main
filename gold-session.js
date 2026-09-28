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

/* ================= hg-v1008: THE COMEX OPENING RANGE =================

   Gold's intraday volume is not uniform: it arrives at the COMEX open
   (8:20 ET), the London fixes and the NY overlap. The opening-range break
   is the oldest structural read of that concentration: the range of the
   first minutes of COMEX trade, and whether the morning then accepted
   prices OUTSIDE it. These two primitives read exactly that off a
   house-shaped 15m tape ({t,o,h,l,c,v}, t seconds or ms), DST-correct via
   Intl — NEVER through hgTzHour's UTC fallback: 8:20 ET is never 8:20 UTC,
   so an Intl-less environment is UNREADABLE here, not approximated.

   THE GRID, STATED HONESTLY: 15m bars align to :00/:15/:30/:45, and ET is a
   whole-hour offset of UTC, so the ET grid IS the UTC grid. The 8:20 open
   falls five minutes into the 8:15–8:30 ET bar. The range is therefore the
   two grid bars that contain the first half hour of COMEX trade — the
   8:15 and 8:30 ET starts, covering 8:20–8:50 — and it is knowable only
   once the second of them has CLOSED (8:45 ET). A read taken before 8:45 ET
   is a read of a range that has not finished printing, so the morning
   window for judging a break runs [8:45, 12:00) ET: after midday the
   opening range is stale structure, not an opening-range play.

   A weekend ET date has no COMEX open at all — a 24/7 perp feed still
   prints 8:15 ET bars on a Saturday, and bars printing is not the exchange
   opening — so Sat/Sun ET dates are UNREADABLE here, decided from the date
   alone, never from whether bars exist. */
function __hgNyCal(ms){
  try{
    var f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false });
    var p = f.formatToParts(new Date(ms)), o = {};
    for (var i = 0; i < p.length; i++) o[p[i].type] = p[i].value;
    var h = +o.hour; if (h === 24) h = 0;
    return { key: o.year + '-' + o.month + '-' + o.day, wd: o.weekday,
             hr: h + (+o.minute) / 60 };
  }catch(e){ return null; }
}

/* The range itself. dayMs = any instant on the COMEX day in question.
   Null — with the reason in why — when the environment, the tape or the
   calendar cannot produce it. */
function hgComexOpenRange(rows, dayMs){
  try{
    if (!Array.isArray(rows) || !rows.length) return null;
    var q = (dayMs === null || dayMs === undefined || dayMs === '') ? NaN : +dayMs;
    if (!isFinite(q)) return null;
    if (q > 0 && q < 1e12) q = q * 1000;
    var day = __hgNyCal(q);
    if (!day) return null;
    if (day.wd === 'Sat' || day.wd === 'Sun') return null;   /* COMEX shut */
    var hi = -Infinity, lo = Infinity, t0 = null, n = 0;
    for (var i = 0; i < rows.length; i++){
      var bt = rows[i] && +rows[i].t;
      if (!isFinite(bt)) continue;
      var bms = bt > 1e12 ? bt : bt * 1000;
      var cal = __hgNyCal(bms);
      if (!cal || cal.key !== day.key) continue;
      if (cal.hr < 8.25 || cal.hr >= 8.75) continue;   /* the 8:15 and 8:30 ET grid bars */
      var h = +rows[i].h, l = +rows[i].l;
      if (!isFinite(h) || !isFinite(l)) continue;
      if (h > hi) hi = h;
      if (l < lo) lo = l;
      if (t0 === null || bms < t0) t0 = bms;
      n++;
    }
    if (n < 2 || !(hi > lo)) return null;
    return { hi: hi, lo: lo, nyDate: day.key, t0: t0, bars: n };
  }catch(e){ return null; }
}

/* The candidate read: at the instant the setup was JUDGED on, had the
   morning accepted prices outside today's COMEX opening range — and on
   which side? The judged bar is the latest bar that had opened by tMs (the
   same instant rule as hgSessionVolPct). States:
     with       the judged bar closed beyond the range on the setup's OWN side
     against    it closed beyond the OPPOSITE side — the morning's break
                opposes this setup (evidence, never a gate)
     none       the tape was read and no range break is in play at the judged
                bar — inside the range, outside the morning window, or before
                the range finished printing
     unreadable no Intl, no tape, a weekend, or no range on the tape
   volOk carries the participation evidence beside the state: the judged
   bar's volume against the two range bars' mean (null when either side is
   unreadable — a missing figure is named, never coerced). */
function hgComexOrbRead(rows, dir, tMs){
  try{
    if (dir !== 'long' && dir !== 'short') return { state: 'unreadable', why: 'no direction to align the break with', volOk: null };
    if (!Array.isArray(rows) || !rows.length) return { state: 'unreadable', why: 'no tape', volOk: null };
    var q = (tMs === null || tMs === undefined || tMs === '') ? NaN : +tMs;
    if (!isFinite(q)) return { state: 'unreadable', why: 'the judged instant is unreadable', volOk: null };
    if (q > 0 && q < 1e12) q = q * 1000;
    var bi = -1, i;
    for (i = rows.length - 1; i >= 0; i--){
      var bt = rows[i] && +rows[i].t;
      if (!isFinite(bt)) continue;
      if ((bt > 1e12 ? bt : bt * 1000) <= q){ bi = i; break; }
    }
    if (bi < 0) return { state: 'unreadable', why: 'the judged instant predates the tape', volOk: null };
    var bms = (+rows[bi].t > 1e12) ? +rows[bi].t : +rows[bi].t * 1000;
    var cal = __hgNyCal(bms);
    if (!cal) return { state: 'unreadable', why: 'no Intl timezone data — 8:20 ET cannot be located honestly', volOk: null };
    var range = hgComexOpenRange(rows, bms);
    if (!range){
      var wknd = (cal.wd === 'Sat' || cal.wd === 'Sun');
      return { state: 'unreadable', volOk: null,
               why: wknd ? 'COMEX shut — a weekend tape prints bars, not an opening range'
                         : 'the opening-range bars are not on this tape' };
    }
    if (cal.hr < 8.75 || cal.hr >= 12){
      return { state: 'none', volOk: null, hi: range.hi, lo: range.lo, nyDate: range.nyDate,
               why: cal.hr < 8.75 ? 'judged before the opening range finished printing (8:45 ET)'
                                  : 'judged after the opening-range morning (12:00 ET) — stale structure, not an opening-range play' };
    }
    var c = +rows[bi].c;
    if (!isFinite(c)) return { state: 'unreadable', why: 'the judged bar has no close', volOk: null };
    var side = (c > range.hi) ? 'up' : (c < range.lo) ? 'down' : null;
    var volOk = null;
    var bv = +rows[bi].v, v0 = NaN, v1 = NaN, found = 0;
    for (i = 0; i < rows.length && found < 2; i++){
      var rt = rows[i] && +rows[i].t;
      if (!isFinite(rt)) continue;
      var rms = rt > 1e12 ? rt : rt * 1000;
      var rc = __hgNyCal(rms);
      if (!rc || rc.key !== range.nyDate || rc.hr < 8.25 || rc.hr >= 8.75) continue;
      var rv = +rows[i].v;
      if (isFinite(rv)){ if (found === 0) v0 = rv; else v1 = rv; found++; }
    }
    if (isFinite(bv) && found === 2) volOk = bv > (v0 + v1) / 2;
    if (!side) return { state: 'none', volOk: volOk, hi: range.hi, lo: range.lo, nyDate: range.nyDate,
                        why: 'the judged bar closed INSIDE the opening range — no break in play' };
    var withIt = (side === 'up' && dir === 'long') || (side === 'down' && dir === 'short');
    return { state: withIt ? 'with' : 'against', volOk: volOk, hi: range.hi, lo: range.lo, nyDate: range.nyDate,
             why: 'the ' + cal.key + ' COMEX opening range (' + range.lo.toFixed(2) + '–' + range.hi.toFixed(2)
                + ') broke ' + side.toUpperCase() + ' and the judged bar closed outside it'
                + (withIt ? ' — the morning\'s break runs WITH this setup' : ' — the morning\'s break runs AGAINST this setup') };
  }catch(e){ return { state: 'unreadable', why: 'the ORB read failed — nothing is inferred', volOk: null }; }
}

G.hgComexOpenRange = hgComexOpenRange;
G.hgComexOrbRead = hgComexOrbRead;
G.hgTzHour = hgTzHour;
G.hgGoldKillzoneRead = hgGoldKillzoneRead;
G.hgGoldScalpSession = hgGoldScalpSession;
G.hgIsLondonFix = hgIsLondonFix;
G.hgIsNYClose = hgIsNYClose;
G.hgGoldSilverBulletBoost = hgGoldSilverBulletBoost;
})();
