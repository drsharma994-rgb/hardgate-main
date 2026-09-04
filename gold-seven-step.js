/* HARDGATE — Gold 7-step setup engine (Playbook Parts 1–9 + Master Catalog).

   One readout, three desks (OMNIGOLD · GOLD SCALP · GOLD SWING):

     STEP 1  indicators + strategy eligibility on live (closed) price
     STEP 2  4H direction — LONG / SHORT / BOTH / NO TRADE (+ RSI veto)
     STEP 3  candidates from every eligible strategy, RULE-BASED CONFLUENCE RANK
     STEP 4  best fit (hard vetoes; ≥10/12 core gates or NO SETUP)
     STEP 5  entry · stop · T1 · T2 · management · size · venue basis
     STEP 6  checklist table → VALID / VALID-HALF / INVALID + sanity a–f
     STEP 7  TRIGGERED / WAIT / EXPIRED against the LAST CLOSED 1H bar

   Contract:
     · closed candles only — the forming bar is dropped before anything reads it
     · 4H derived from 1H aligned to 22:00 UTC when the feed has no 4H leg
     · every number comes from the data; missing data prints "unavailable"
     · no win rate, no probability, no confidence % — "gates passed" and
       "rule-based confluence rank" are the only strength words
     · stale feed (last closed bar > 2h old), missing 1H bars or abnormal venue
       basis → DATA_UNAVAILABLE and the readout stops
     · one vote per evidence family (structure · flow · trend · momentum ·
       volatility · positioning · macro)
     · never invents a direction; against-tape candidates are HELD, never best fit
     · times printed IST with UTC in brackets

   Feeds through the existing gold engines when they are loaded
   (goldVolumeProfile, hgGoldVpLocationGrade, hgGoldVpLvnBetween,
   hgGoldVpContractSize, hgGoldNewsIsTier1, hgGoldFormingStack) and degrades to
   the local helpers below when they are not, so tests run standalone.        */
(function (root) {
  'use strict';
  var W = root || (typeof window !== 'undefined' ? window : globalThis);

  var HOUR = 3600, H4 = 14400, H4_ANCHOR_UTC = 22 * HOUR;
  var STALE_MS = 2 * 3600 * 1000 + 5 * 60 * 1000;   /* last closed 1H bar ≤ 2h (+5m grace) */
  var BASIS_ABNORMAL_PCT = 1.5;
  var MIN_1H_BARS = 60;
  var ROW_USD = 2;                                    /* $2 volume-profile rows */
  var EQ_TOL_USD = 1.5;
  var STOP_BUF_MIN_USD = 2;
  var MAX_SWEEP_AGE = 3;
  var CORE_GATES = 12;
  var MIN_GATES_SETUP = 10;

  function gfn(n){ try{ var f = W[n]; return typeof f === 'function' ? f : null; }catch(e){ return null; } }
  function fin(x){ var v = +x; return isFinite(v) ? v : NaN; }
  function esc(s){
    return String(s == null ? '' : s).replace(/[<>&]/g, function(c){
      return c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;';
    });
  }
  /* null / '' / undefined are absences, never 0.00 — the guard test enforces this */
  function isNum(x){ return x != null && x !== '' && typeof x !== 'boolean' && isFinite(+x); }
  function px(x){ return isNum(x) ? (+x).toFixed(2) : 'unavailable'; }
  function num(x, d){ return isNum(x) ? (+x).toFixed(d == null ? 2 : d) : 'unavailable'; }
  function up(s){ return String(s || '').toUpperCase(); }

  /* ---------------- rows ---------------- */
  function normRows(rows){
    if (!Array.isArray(rows)) return [];
    var out = [], i, r, t;
    for (i = 0; i < rows.length; i++){
      r = rows[i];
      if (!r || typeof r !== 'object') continue;
      t = fin(r.t != null ? r.t : (r.time != null ? r.time : r.ts));
      if (!isFinite(t)) continue;
      if (t > 1e11) t = Math.floor(t / 1000);
      var o = fin(r.o), h = fin(r.h), l = fin(r.l), c = fin(r.c);
      if (!isFinite(c) || !isFinite(h) || !isFinite(l)) continue;
      out.push({ t: t, o: isFinite(o) ? o : c, h: h, l: l, c: c, v: isFinite(fin(r.v)) ? fin(r.v) : 0 });
    }
    out.sort(function(a, b){ return a.t - b.t; });
    return out;
  }

  /** Drop the still-forming bar: a bar is closed only when t + tf ≤ now. */
  function closedRows(rows, tfSec, nowMs){
    rows = normRows(rows);
    var nowSec = Math.floor((isFinite(nowMs) ? nowMs : Date.now()) / 1000);
    while (rows.length && rows[rows.length - 1].t + tfSec > nowSec) rows.pop();
    return rows;
  }

  /** 4H bars from 1H, aligned to 22:00 UTC (Globex day open). Closed buckets only. */
  function derive4h(rows1h, nowMs){
    var rows = normRows(rows1h);
    var nowSec = Math.floor((isFinite(nowMs) ? nowMs : Date.now()) / 1000);
    var buckets = {}, order = [], i, r, b;
    for (i = 0; i < rows.length; i++){
      r = rows[i];
      b = Math.floor((r.t - H4_ANCHOR_UTC) / H4) * H4 + H4_ANCHOR_UTC;
      if (!buckets[b]){ buckets[b] = { t: b, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v, n: 1 }; order.push(b); }
      else {
        var k = buckets[b];
        if (r.h > k.h) k.h = r.h;
        if (r.l < k.l) k.l = r.l;
        k.c = r.c; k.v += r.v; k.n++;
      }
    }
    var out = [];
    for (i = 0; i < order.length; i++){
      b = buckets[order[i]];
      if (b.t + H4 > nowSec) continue;
      out.push({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
    }
    return out;
  }

  /* ---------------- math ---------------- */
  function emaSeries(vals, n){
    var out = [], k = 2 / (n + 1), i, e = NaN;
    for (i = 0; i < vals.length; i++){
      var v = vals[i];
      if (!isFinite(v)){ out.push(e); continue; }
      e = isFinite(e) ? (v - e) * k + e : v;
      out.push(e);
    }
    return out;
  }
  function closes(rows){ return rows.map(function(r){ return r.c; }); }
  function rsi14(rows){
    var n = 14;
    if (!rows || rows.length < n + 1) return NaN;
    var i, d, g = 0, l = 0;
    for (i = 1; i <= n; i++){
      d = rows[i].c - rows[i - 1].c;
      if (d >= 0) g += d; else l -= d;
    }
    var ag = g / n, al = l / n;
    for (i = n + 1; i < rows.length; i++){
      d = rows[i].c - rows[i - 1].c;
      ag = (ag * (n - 1) + (d > 0 ? d : 0)) / n;
      al = (al * (n - 1) + (d < 0 ? -d : 0)) / n;
    }
    if (al === 0) return 100;
    return 100 - 100 / (1 + ag / al);
  }
  function atrN(rows, n){
    if (!rows || rows.length < n + 1) return NaN;
    var s = 0, i, prev, tr;
    for (i = rows.length - n; i < rows.length; i++){
      prev = rows[i - 1].c;
      tr = Math.max(rows[i].h - rows[i].l, Math.abs(rows[i].h - prev), Math.abs(rows[i].l - prev));
      s += tr;
    }
    return s / n;
  }
  function ker20(rows){
    if (!rows || rows.length < 21) return NaN;
    var n = rows.length, net = Math.abs(rows[n - 1].c - rows[n - 21].c), path = 0, i;
    for (i = n - 20; i < n; i++) path += Math.abs(rows[i].c - rows[i - 1].c);
    return path > 0 ? net / path : NaN;
  }
  /** Confirmed pivots (k bars each side). Last pivot is ≥k bars back — never the forming edge. */
  function pivots(rows, k){
    var hs = [], ls = [], i, j, isH, isL;
    k = k || 2;
    for (i = k; i < rows.length - k; i++){
      isH = true; isL = true;
      for (j = 1; j <= k; j++){
        if (!(rows[i].h >= rows[i - j].h && rows[i].h >= rows[i + j].h)) isH = false;
        if (!(rows[i].l <= rows[i - j].l && rows[i].l <= rows[i + j].l)) isL = false;
      }
      if (isH) hs.push({ i: i, v: rows[i].h, t: rows[i].t });
      if (isL) ls.push({ i: i, v: rows[i].l, t: rows[i].t });
    }
    return { highs: hs, lows: ls };
  }

  /* ---------------- time / sessions (DST via Intl) ---------------- */
  function tzHour(ms, tz){
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
      var utc = d.getUTCHours() + d.getUTCMinutes() / 60;
      if (tz === 'Asia/Kolkata') return (utc + 5.5) % 24;
      return utc;
    }
  }
  /** UTC offset (hours) of a zone at ms — DST-correct, from Intl. */
  function tzOffsetHours(ms, tz){
    var local = tzHour(ms, tz);
    var d = new Date(ms), utc = d.getUTCHours() + d.getUTCMinutes() / 60;
    var off = local - utc;
    if (off > 12) off -= 24;
    if (off < -12) off += 24;
    return Math.round(off * 4) / 4;
  }
  function fmtHM(ms, tz){
    try{
      return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
    }catch(e){
      var h = tzHour(ms, tz), hh = Math.floor(h), mm = Math.round((h - hh) * 60);
      return ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2);
    }
  }
  function fmtDay(ms, tz){
    try{
      return new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: 'short' }).format(new Date(ms));
    }catch(e){ return new Date(ms).toISOString().slice(5, 10); }
  }
  /** "18:30 IST (13:00 UTC)" */
  function istUtc(ms){
    if (!isFinite(ms)) return 'unavailable';
    return fmtHM(ms, 'Asia/Kolkata') + ' IST (' + fmtHM(ms, 'UTC') + ' UTC)';
  }
  function istUtcDay(ms){
    if (!isFinite(ms)) return 'unavailable';
    return fmtDay(ms, 'Asia/Kolkata') + ' ' + istUtc(ms);
  }
  /** UTC ms of the next occurrence of local `hour` in `tz` at/after nowMs. */
  function nextLocalHourMs(nowMs, tz, hour){
    var i, off, cand;
    var dayStart = Math.floor(nowMs / 86400000) * 86400000;
    for (i = -1; i <= 2; i++){
      cand = dayStart + i * 86400000;
      off = tzOffsetHours(cand + 12 * 3600000, tz);
      var ms = cand + (hour - off) * 3600000;
      if (ms > nowMs) return ms;
    }
    return NaN;
  }
  function todayLocalHourMs(nowMs, tz, hour){
    var dayStart = Math.floor(nowMs / 86400000) * 86400000;
    var off = tzOffsetHours(nowMs, tz);
    var ms = dayStart + (hour - off) * 3600000;
    if (ms < nowMs - 20 * 3600000) ms += 86400000;
    return ms;
  }

  /** Session with DST handled. Times inside are local exchange hours. */
  function goldSession(nowMs){
    var lon = tzHour(nowMs, 'Europe/London');
    var ny = tzHour(nowMs, 'America/New_York');
    var out = { key: 'ASIA', label: 'ASIA', lonHour: lon, nyHour: ny, tradeable: false };
    if (ny >= 8.5 && ny < 10){ out.key = 'NY_OPEN'; out.label = 'NY OPEN'; out.tradeable = true; }
    else if (ny >= 10 && lon < 17 && ny < 17){ out.key = 'NY_OVERLAP'; out.label = 'NY OVERLAP (London still open)'; out.tradeable = true; }
    else if (ny >= 10 && ny < 17){ out.key = 'NY_PM'; out.label = 'NY AFTERNOON (manage only)'; out.tradeable = false; }
    else if (lon >= 8 && lon < 10){ out.key = 'LONDON_OPEN'; out.label = 'LONDON OPEN'; out.tradeable = true; }
    else if (lon >= 10 && lon < 17 && ny < 8.5){ out.key = 'LONDON_LATE'; out.label = 'LONDON LATE'; out.tradeable = true; }
    else { out.key = 'ASIA'; out.label = 'ASIA'; out.tradeable = false; }
    out.londonDst = tzOffsetHours(nowMs, 'Europe/London') >= 1;
    out.nyDst = tzOffsetHours(nowMs, 'America/New_York') >= -4;
    out.fixWindow = (lon >= 10.33 && lon <= 10.67) || (lon >= 14.83 && lon <= 15.17);
    out.londonCloseMs = todayLocalHourMs(nowMs, 'Europe/London', 17);
    return out;
  }

  /* ---------------- news ---------------- */
  var TIER2 = /\bPPI\b|RETAIL SALES|\bPMI\b|\bISM\b|JOLTS|JOBLESS|CLAIMS|\bPCE\b|UNEMPLOYMENT|POWELL|FED (CHAIR|SPEAK|MINUTES)|\bECB\b|\bBOE\b|CONSUMER (CONFIDENCE|SENTIMENT)|DURABLE|HOUSING|MICHIGAN|ADP/;
  function isTier1(title){
    var f = gfn('hgGoldNewsIsTier1');
    if (f){ try{ return !!f(title); }catch(e){} }
    var s = up(title);
    return /\bCPI\b|CONSUMER PRICE|\bNFP\b|NON[\s-]?FARM|PAYROLLS|\bFOMC\b|INTEREST RATE DECISION|\bGDP\b/.test(s);
  }
  function newsEvents(news){
    if (!news) return null;
    var evs = Array.isArray(news) ? news.slice() : (Array.isArray(news.events) ? news.events.slice() : null);
    if (news && Array.isArray(news.fomc)){ evs = evs || []; evs = evs.concat(news.fomc); }
    return evs;
  }
  function newsRead(news, nowMs){
    var out = { available: false, lock: false, lockWhy: '', next: null, nextTier: null, nextMs: NaN, window: '' };
    var evs = newsEvents(news);
    if (!evs){ return out; }
    out.available = true;
    var i, ev, t, title, tier, best = null;
    for (i = 0; i < evs.length; i++){
      ev = evs[i]; if (!ev) continue;
      title = ev.title || ev.name || ev.event || '';
      tier = (isTier1(title) || ev.fomcDecision) ? 1 : (TIER2.test(up(title)) ? 2 : 0);
      if (!tier) continue;
      t = fin(ev.t != null ? ev.t : ev.timestamp);
      if (!isFinite(t)) continue;
      if (t < 1e12) t *= 1000;
      var before = tier === 1 ? 30 : 15, after = tier === 1 ? 15 : 10;
      if (nowMs >= t - before * 60000 && nowMs <= t + after * 60000){
        out.lock = true;
        out.lockWhy = 'Tier ' + tier + ' lockout — ' + title + ' at ' + istUtc(t) + ' (−' + before + 'm / +' + after + 'm)';
      }
      if (t + after * 60000 >= nowMs && (!best || t < best.t)) best = { t: t, title: title, tier: tier, before: before, after: after };
    }
    if (best){
      out.next = best.title; out.nextTier = best.tier; out.nextMs = best.t;
      out.window = istUtc(best.t - best.before * 60000) + ' → ' + fmtHM(best.t + best.after * 60000, 'Asia/Kolkata') + ' IST';
    }
    return out;
  }

  /* ---------------- volume profile ($2 rows) ---------------- */
  function volProfile(rows, rowUsd){
    if (!rows || rows.length < 3) return null;
    var hi = -Infinity, lo = Infinity, i, r;
    for (i = 0; i < rows.length; i++){ r = rows[i]; if (r.h > hi) hi = r.h; if (r.l < lo) lo = r.l; }
    if (!(hi > lo)) return null;
    var bins = Math.max(5, Math.min(400, Math.round((hi - lo) / (rowUsd || ROW_USD))));
    var vp = null, f = gfn('goldVolumeProfile');
    if (f){ try{ vp = f(rows, rows.length, bins); }catch(e){ vp = null; } }
    if (vp && isFinite(vp.pocPrice)) return vp;
    /* local fallback — POC / 70% VA / HVN (≥1.5×avg local max) / LVN (≤0.5×avg local min) */
    var binSize = (hi - lo) / bins, prof = new Array(bins), tot = 0, hasVol = false;
    for (i = 0; i < bins; i++) prof[i] = 0;
    for (i = 0; i < rows.length; i++){
      r = rows[i];
      var v = r.v > 0 ? r.v : 1; if (r.v > 0) hasVol = true;
      var b = Math.min(bins - 1, Math.max(0, Math.floor(((r.h + r.l + r.c) / 3 - lo) / binSize)));
      prof[b] += v; tot += v;
    }
    var maxV = 0, poc = 0;
    for (i = 0; i < bins; i++) if (prof[i] > maxV){ maxV = prof[i]; poc = i; }
    var mean = tot / bins, hvns = [], lvns = [];
    for (i = 0; i < bins; i++){
      var L = i > 0 ? prof[i - 1] : prof[i], R = i < bins - 1 ? prof[i + 1] : prof[i];
      if (prof[i] >= L && prof[i] >= R && prof[i] >= 1.5 * mean && prof[i] >= 0.4 * maxV) hvns.push(lo + i * binSize + binSize / 2);
      if (prof[i] <= L && prof[i] <= R && prof[i] > 0 && prof[i] <= 0.5 * mean) lvns.push(lo + i * binSize + binSize / 2);
    }
    var target = tot * 0.7, loI = poc, hiI = poc, cov = prof[poc];
    while (cov < target && (loI > 0 || hiI < bins - 1)){
      var aL = loI > 0 ? prof[loI - 1] : -1, aH = hiI < bins - 1 ? prof[hiI + 1] : -1;
      if (aH >= aL){ hiI++; cov += prof[hiI]; } else { loI--; cov += prof[loI]; }
    }
    return { pocPrice: lo + poc * binSize + binSize / 2, vah: lo + (hiI + 1) * binSize, val: lo + loI * binSize,
             hvns: hvns, hvnsStrict: hvns.slice(), lvns: lvns, binSize: binSize, profileHigh: hi, profileLow: lo,
             volumeTrusted: hasVol, bars: rows.length };
  }
  /** Contiguous HVN / LVN zones as "lo–hi" strings. */
  function zones(levels, binSize){
    if (!levels || !levels.length) return [];
    var s = levels.slice().sort(function(a, b){ return a - b; }), out = [], i, start = s[0], prev = s[0];
    for (i = 1; i <= s.length; i++){
      if (i < s.length && s[i] - prev <= binSize * 1.5){ prev = s[i]; continue; }
      out.push({ lo: start - binSize / 2, hi: prev + binSize / 2 });
      if (i < s.length){ start = s[i]; prev = s[i]; }
    }
    return out;
  }
  function zoneTxt(z){ return z.map(function(o){ return px(o.lo) + '–' + px(o.hi); }).join(', ') || 'none'; }

  /** Dealing range = last confirmed 4H swing low ↔ swing high. When price has
      already left that box the range is being extended, so the profile runs
      from the older pivot to the last closed bar and the box grows with it. */
  function dealingRange(rows4h){
    var pv = pivots(rows4h, 2);
    if (!pv.highs.length || !pv.lows.length) return null;
    var H = pv.highs[pv.highs.length - 1], L = pv.lows[pv.lows.length - 1];
    var a = Math.min(H.i, L.i), n = rows4h.length;
    var pxNow = rows4h[n - 1].c;
    var hi = H.v, lo = L.v, i;
    for (i = a; i < n; i++){ if (rows4h[i].h > hi) hi = rows4h[i].h; if (rows4h[i].l < lo) lo = rows4h[i].l; }
    if (!(hi > lo)) return null;
    var eq = (hi + lo) / 2;
    return { hi: hi, lo: lo, eq: eq, fromI: a, toI: n - 1, rows: rows4h.slice(a),
             half: pxNow > eq ? 'PREMIUM' : 'DISCOUNT', pct: (pxNow - lo) / (hi - lo),
             lastHighT: H.t, lastLowT: L.t, extended: pxNow > H.v || pxNow < L.v };
  }

  /* ---------------- sessions / days ---------------- */
  function dayKey(t){ return Math.floor(t / 86400); }
  function sessionPocs(rows1h, n){
    var days = {}, order = [], i, k;
    for (i = 0; i < rows1h.length; i++){
      k = dayKey(rows1h[i].t);
      if (!days[k]){ days[k] = []; order.push(k); }
      days[k].push(rows1h[i]);
    }
    var out = [];
    for (i = Math.max(0, order.length - n); i < order.length; i++){
      var rs = days[order[i]];
      if (rs.length < 4) continue;
      var vp = volProfile(rs, ROW_USD);
      if (vp) out.push({ day: new Date(order[i] * 86400000).toISOString().slice(0, 10), poc: vp.pocPrice, bars: rs.length });
    }
    return out;
  }
  function pocStep(pocs){
    if (!pocs || pocs.length < 2) return 'unavailable';
    var ups = 0, dns = 0, i;
    for (i = 1; i < pocs.length; i++){
      if (pocs[i].poc > pocs[i - 1].poc + 0.5) ups++;
      else if (pocs[i].poc < pocs[i - 1].poc - 0.5) dns++;
    }
    if (ups && !dns) return 'UP';
    if (dns && !ups) return 'DOWN';
    return 'FLAT';
  }
  /** Asia 00:00 UTC → London open (London local 08:00, DST-aware). */
  function asiaRange(rows1h, nowMs){
    if (!rows1h.length) return null;
    var lastT = rows1h[rows1h.length - 1].t;
    var d0 = Math.floor(lastT / 86400) * 86400;
    var lonOff = tzOffsetHours(d0 * 1000 + 6 * 3600000, 'Europe/London');
    var end = d0 + (8 - lonOff) * 3600;
    var hi = -Infinity, lo = Infinity, i, rs = [];
    for (i = 0; i < rows1h.length; i++){
      var t = rows1h[i].t;
      if (t < d0 || t >= end) continue;
      rs.push(rows1h[i]);
      if (rows1h[i].h > hi) hi = rows1h[i].h;
      if (rows1h[i].l < lo) lo = rows1h[i].l;
    }
    if (rs.length < 2 || !(hi > lo)) return null;
    var vp = volProfile(rs, ROW_USD);
    return { hi: hi, lo: lo, poc: vp ? vp.pocPrice : NaN, bars: rs.length, building: lastT + HOUR < end,
             startMs: d0 * 1000, endMs: end * 1000 };
  }
  function priorDay(rows1h){
    var f = gfn('hgGoldPriorDayLevels');
    if (f){ try{ var r = f(rows1h); if (r && r.ok) return { hi: r.hi, lo: r.lo }; }catch(e){} }
    if (!rows1h.length) return null;
    var prev = dayKey(rows1h[rows1h.length - 1].t) - 1, hi = -Infinity, lo = Infinity, i, saw = false;
    for (i = 0; i < rows1h.length; i++){
      if (dayKey(rows1h[i].t) !== prev) continue;
      saw = true; if (rows1h[i].h > hi) hi = rows1h[i].h; if (rows1h[i].l < lo) lo = rows1h[i].l;
    }
    return saw && hi > lo ? { hi: hi, lo: lo } : null;
  }
  function isoWeek(t){ return Math.floor((t - 4 * 86400 + 3 * 86400) / (7 * 86400)); } /* weeks starting Mon 00:00 UTC */
  function priorWeek(rows1h){
    if (!rows1h.length) return null;
    var cur = isoWeek(rows1h[rows1h.length - 1].t), prev = cur - 1, hi = -Infinity, lo = Infinity, i, saw = false;
    for (i = 0; i < rows1h.length; i++){
      if (isoWeek(rows1h[i].t) !== prev) continue;
      saw = true; if (rows1h[i].h > hi) hi = rows1h[i].h; if (rows1h[i].l < lo) lo = rows1h[i].l;
    }
    return saw && hi > lo ? { hi: hi, lo: lo } : null;
  }
  function equalExtremes(rows1h, tolUsd){
    var pv = pivots(rows1h.slice(-120), 2), out = { highs: [], lows: [] };
    function cluster(list, dest){
      var i, j;
      for (i = list.length - 1; i >= 0; i--){
        for (j = i - 1; j >= 0; j--){
          if (Math.abs(list[i].v - list[j].v) <= tolUsd && list[i].i - list[j].i >= 3){
            dest.push({ level: (list[i].v + list[j].v) / 2 });
            return;
          }
        }
      }
    }
    cluster(pv.highs, out.highs); cluster(pv.lows, out.lows);
    return out;
  }
  /** Fresh 1H OB: last opposing candle before a ≥1.5×ATR displacement that broke structure; unmitigated. */
  function freshObs(rows1h, atr1h){
    var out = { bull: null, bear: null };
    if (!rows1h || rows1h.length < 30 || !(atr1h > 0)) return out;
    var n = rows1h.length, i, j, k;
    for (i = n - 2; i >= Math.max(5, n - 80); i--){
      var body = rows1h[i].c - rows1h[i].o;
      if (Math.abs(body) < 1.5 * atr1h) continue;
      var dir = body > 0 ? 'bull' : 'bear';
      if (out[dir]) continue;
      var prevHi = -Infinity, prevLo = Infinity;
      for (k = Math.max(0, i - 10); k < i; k++){ if (rows1h[k].h > prevHi) prevHi = rows1h[k].h; if (rows1h[k].l < prevLo) prevLo = rows1h[k].l; }
      var broke = dir === 'bull' ? rows1h[i].c > prevHi : rows1h[i].c < prevLo;
      if (!broke) continue;
      for (j = i - 1; j >= Math.max(0, i - 6); j--){
        var opp = dir === 'bull' ? rows1h[j].c < rows1h[j].o : rows1h[j].c > rows1h[j].o;
        if (!opp) continue;
        var lo = rows1h[j].l, hi = rows1h[j].h, mit = false;
        for (k = i + 1; k < n; k++){
          if (dir === 'bull' && rows1h[k].l <= lo){ mit = true; break; }
          if (dir === 'bear' && rows1h[k].h >= hi){ mit = true; break; }
        }
        if (!mit) out[dir] = { lo: lo, hi: hi, age: n - 1 - j, mid: (lo + hi) / 2 };
        break;
      }
    }
    return out;
  }
  function adr10(rows1h){
    var days = {}, order = [], i, k;
    for (i = 0; i < rows1h.length; i++){
      k = dayKey(rows1h[i].t);
      if (!days[k]){ days[k] = { hi: rows1h[i].h, lo: rows1h[i].l, n: 1 }; order.push(k); }
      else { var d = days[k]; if (rows1h[i].h > d.hi) d.hi = rows1h[i].h; if (rows1h[i].l < d.lo) d.lo = rows1h[i].l; d.n++; }
    }
    if (order.length < 3) return { adr: NaN, used: NaN, today: NaN };
    var todayK = order[order.length - 1], prior = order.slice(0, -1).slice(-10), s = 0, c = 0;
    for (i = 0; i < prior.length; i++){ var dd = days[prior[i]]; if (dd.n >= 6 && dd.hi > dd.lo){ s += dd.hi - dd.lo; c++; } }
    var adr = c ? s / c : NaN;
    var tr = days[todayK].hi - days[todayK].lo;
    return { adr: adr, today: tr, used: adr > 0 ? tr / adr * 100 : NaN, days: c };
  }
  function structure1h(rows1h){
    var pv = pivots(rows1h.slice(-60), 2), out = { higherLows: false, lowerHighs: false };
    var L = pv.lows, H = pv.highs;
    if (L.length >= 2) out.higherLows = L[L.length - 1].v > L[L.length - 2].v;
    if (H.length >= 2) out.lowerHighs = H[H.length - 1].v < H[H.length - 2].v;
    return out;
  }

  /* ---------------- strategy eligibility (Catalog live set + rules) ---------------- */
  var STRATS = [
    { id: 'S0',  name: 'AMD sweep → reclaim (Asia / PDH-PDL / PWH-PWL / EQ pool)', role: 'lead',
      when: function(c){ if (!c.session.tradeable) return 'session ' + c.session.label; if (c.adrUsed > 120) return 'ADR used ' + num(c.adrUsed, 0) + '% > 120'; return null; } },
    { id: 'S19', name: 'Wyckoff spring / UTAD at range edge', role: 'lead',
      when: function(c){ if (!c.session.tradeable) return 'session ' + c.session.label; if (isFinite(c.ker) && c.ker > 0.6) return 'KER ' + num(c.ker) + ' trending — no range to spring'; return null; } },
    { id: 'S20', name: 'Donchian-20 turtle soup (pool sweep)', role: 'lead',
      when: function(c){ if (!c.session.tradeable) return 'session ' + c.session.label; return null; } },
    { id: 'S37', name: 'Failed-sweep continuation (second chance)', role: 'rule',
      when: function(c){ return c.acceptance ? null : 'no acceptance through a pool in the last 3 bars'; } },
    { id: 'S1',  name: 'Value-area rotation (targets)', role: 'targets', when: function(){ return null; } },
    { id: 'S2',  name: 'Naked POC / LVN traversal (targets)', role: 'targets', when: function(){ return null; } },
    { id: 'S9',  name: 'Premium / discount EQ (location filter)', role: 'context', when: function(){ return null; } },
    { id: 'S3',  name: 'Developing-POC pullback', role: 'disabled-lead',
      when: function(c){ if (!(c.ker >= 0.6)) return 'KER ' + num(c.ker) + ' not trending (needs > 0.6)'; return 'catalog freeze S66 — LEAD disabled until SPRT'; } },
    { id: 'S5',  name: 'NY initial-balance extension', role: 'disabled-lead',
      when: function(c){ if (c.session.key !== 'NY_OPEN' && c.session.key !== 'NY_OVERLAP') return 'not NY window'; if (!(c.ker >= 0.6)) return 'KER ' + num(c.ker) + ' mixed'; return 'catalog freeze S66 — LEAD disabled until SPRT'; } },
    { id: 'S8',  name: 'LBMA fix scalp', role: 'disabled-lead',
      when: function(c){ if (!c.session.fixWindow) return 'not fix window (10:30 / 15:00 London)'; return 'catalog freeze S66 — LEAD disabled until SPRT'; } },
    { id: 'S12', name: 'NR7 / compression breakout', role: 'disabled-lead',
      when: function(c){ if (c.atrRegime !== 'compressed') return 'ATR regime ' + c.atrRegime + ' (needs compressed)'; return 'catalog freeze S66 — LEAD disabled until SPRT'; } },
    { id: 'S13', name: 'Silver-confirmed continuation', role: 'disabled-lead',
      when: function(c){ if (!(c.adrUsed >= 80)) return 'ADR used ' + num(c.adrUsed, 0) + '% < 80'; return 'catalog freeze S66 — LEAD disabled until SPRT'; } },
    { id: 'S14', name: 'ADR exhaustion fade', role: 'disabled-lead',
      when: function(c){ if (!(c.adrUsed >= 80)) return 'ADR used ' + num(c.adrUsed, 0) + '% < 80'; return 'catalog freeze S66 — LEAD disabled until SPRT'; } },
    { id: 'S22', name: 'Session VWAP ±σ reversion', role: 'disabled-lead',
      when: function(c){ if (!c.session.tradeable) return 'session ' + c.session.label; return 'catalog freeze S66 — LEAD disabled until SPRT'; } },
    { id: 'S33', name: 'Close z-score fade', role: 'disabled-lead',
      when: function(c){ if (!(c.ker < 0.3)) return 'KER ' + num(c.ker) + ' not chop (needs < 0.3)'; return 'catalog freeze S66 — LEAD disabled until SPRT'; } },
    { id: 'S36', name: 'DXY SMT divergence', role: 'disabled-lead',
      when: function(c){ if (c.dxy.state !== 'live') return 'DXY ' + c.dxy.state; return 'catalog freeze S66 — LEAD disabled until SPRT'; } }
  ];
  function eligibility(ctx){
    var elig = [], dis = [], i, s, why;
    for (i = 0; i < STRATS.length; i++){
      s = STRATS[i];
      why = ctx.news.lock && s.role !== 'targets' && s.role !== 'context' ? ctx.news.lockWhy : s.when(ctx);
      if (!why) elig.push({ id: s.id, name: s.name, role: s.role });
      else dis.push({ id: s.id, name: s.name, role: s.role, why: why });
    }
    return { eligible: elig, disabled: dis };
  }

  /* ---------------- pools + sweeps (S0 / S20 / S37 detectors) ---------------- */
  function pools(ctx){
    var out = [];
    if (ctx.asia){ out.push({ kind: 'Asia low', level: ctx.asia.lo, side: 'low', sid: 'S0' }); out.push({ kind: 'Asia high', level: ctx.asia.hi, side: 'high', sid: 'S0' }); }
    if (ctx.pd){ out.push({ kind: 'PDL', level: ctx.pd.lo, side: 'low', sid: 'S0' }); out.push({ kind: 'PDH', level: ctx.pd.hi, side: 'high', sid: 'S0' }); }
    if (ctx.pw){ out.push({ kind: 'PWL', level: ctx.pw.lo, side: 'low', sid: 'S0' }); out.push({ kind: 'PWH', level: ctx.pw.hi, side: 'high', sid: 'S0' }); }
    var i;
    for (i = 0; i < ctx.eq.lows.length; i++) out.push({ kind: 'equal lows', level: ctx.eq.lows[i].level, side: 'low', sid: 'S20' });
    for (i = 0; i < ctx.eq.highs.length; i++) out.push({ kind: 'equal highs', level: ctx.eq.highs[i].level, side: 'high', sid: 'S20' });
    if (ctx.donchian){ out.push({ kind: 'Donchian-20 low', level: ctx.donchian.lo, side: 'low', sid: 'S20' }); out.push({ kind: 'Donchian-20 high', level: ctx.donchian.hi, side: 'high', sid: 'S20' }); }
    if (ctx.vp4h && isFinite(ctx.vp4h.val)) out.push({ kind: 'VAL', level: ctx.vp4h.val, side: 'low', sid: 'S19' });
    if (ctx.vp4h && isFinite(ctx.vp4h.vah)) out.push({ kind: 'VAH', level: ctx.vp4h.vah, side: 'high', sid: 'S19' });
    return out;
  }
  /** Closed-bar sweep read on the last MAX_SWEEP_AGE+1 bars. */
  function sweepRead(rows1h, pool, atr1h){
    var n = rows1h.length, i, bar, out = null;
    var minBreach = Math.max(0.5, 0.05 * atr1h);
    /* oldest breach inside the window is the sweep origin; the wick is the
       window extreme so a deeper follow-through bar still sets the stop */
    for (i = Math.max(0, n - 1 - MAX_SWEEP_AGE); i < n; i++){
      bar = rows1h[i];
      if (pool.side === 'low' && bar.l < pool.level - minBreach){
        if (!out) out = { dir: 'long', wick: bar.l, sweepI: i, age: n - 1 - i, breach: pool.level - bar.l };
        else if (bar.l < out.wick){ out.wick = bar.l; out.breach = pool.level - bar.l; }
      }
      if (pool.side === 'high' && bar.h > pool.level + minBreach){
        if (!out) out = { dir: 'short', wick: bar.h, sweepI: i, age: n - 1 - i, breach: bar.h - pool.level };
        else if (bar.h > out.wick){ out.wick = bar.h; out.breach = bar.h - pool.level; }
      }
    }
    if (!out) return null;
    out.pool = pool;
    var last = rows1h[n - 1];
    out.reclaimed = out.dir === 'long' ? last.c > pool.level : last.c < pool.level;
    /* acceptance = two consecutive closes beyond the pool after the sweep */
    var beyond = 0;
    for (i = out.sweepI; i < n; i++){
      var c = rows1h[i].c;
      if ((out.dir === 'long' && c < pool.level) || (out.dir === 'short' && c > pool.level)) beyond++; else beyond = 0;
    }
    out.acceptance = beyond >= 2;
    var disp = Math.abs(last.c - out.wick);
    out.displacementAtr = atr1h > 0 ? disp / atr1h : NaN;
    return out;
  }

  /** Order block of a sweep setup (Playbook P1 §6.1): the last opposing candle
      between the sweep bar and the reclaim bar (exclusive) — the origin the
      displacement left. Falls back to the sweep candle itself. Zone = wick to
      body top (long) / body bottom to wick (short). */
  function sweepOb(rows, sweepI, dir){
    if (!rows || !isFinite(sweepI) || sweepI < 0 || sweepI >= rows.length) return null;
    var n = rows.length, k, bar = null;
    for (k = n - 2; k >= sweepI; k--){
      var b = rows[k];
      if ((dir === 'long' && b.c < b.o) || (dir === 'short' && b.c > b.o)){ bar = b; break; }
    }
    if (!bar) bar = rows[sweepI];
    return dir === 'long' ? { lo: bar.l, hi: Math.max(bar.o, bar.c), i: k >= sweepI ? k : sweepI }
                          : { lo: Math.min(bar.o, bar.c), hi: bar.h, i: k >= sweepI ? k : sweepI };
  }

  /* ---------------- gates (12 core, per Playbook §10) ---------------- */
  function gradeRank(g){ return g === 'A' ? 4 : g === 'B+' ? 3 : g === 'B' ? 2 : 1; }
  function locationGrade(ctx, entry, dir, obOk, poolNear){
    var f = gfn('hgGoldVpLocationGrade');
    if (f && ctx.vp4h){
      try{ var r = f({ vprof: ctx.vp4h, entry: entry, dir: dir, atr: ctx.atr1h, obOk: obOk, poolNear: poolNear }); if (r && r.grade) return r; }catch(e){}
    }
    var vp = ctx.vp4h, out = { grade: 'C', why: 'no 4H node', node: false, ob: !!obOk, pool: !!poolNear };
    if (!vp) return out;
    var tol = Math.max(ctx.atr1h * 0.35, vp.binSize * 2), i, atNode = false, atVa = false, atLvn = false;
    if (Math.abs(entry - vp.pocPrice) <= tol) atNode = true;
    if (Math.abs(entry - vp.vah) <= tol || Math.abs(entry - vp.val) <= tol) atVa = true;
    var hv = vp.hvnsStrict || vp.hvns || [];
    for (i = 0; i < hv.length; i++) if (Math.abs(entry - hv[i]) <= tol){ atNode = true; break; }
    for (i = 0; i < (vp.lvns || []).length; i++) if (Math.abs(entry - vp.lvns[i]) <= tol){ atLvn = true; break; }
    out.node = atNode || atVa;
    if (atLvn && obOk){ out.grade = 'C'; out.why = 'OB inside LVN — watch only'; return out; }
    if (atNode && obOk && poolNear){ out.grade = 'A'; out.why = '4H HVN/POC + unmitigated OB + pool beyond'; return out; }
    if (atVa && obOk && poolNear){ out.grade = 'B+'; out.why = 'VA edge + OB + pool'; return out; }
    if (atNode && obOk){ out.grade = 'B'; out.why = '4H node + OB — needs clear rejection'; return out; }
    out.why = out.node ? 'node without full confluence' : 'no tradeable location';
    return out;
  }
  function lvnBetween(entry, t1, vp){
    var f = gfn('hgGoldVpLvnBetween');
    if (f){ try{ return !!f(entry, t1, vp); }catch(e){} }
    if (!vp || !vp.lvns || !isFinite(t1)) return false;
    var lo = Math.min(entry, t1), hi = Math.max(entry, t1), i;
    for (i = 0; i < vp.lvns.length; i++) if (vp.lvns[i] > lo + vp.binSize / 2 && vp.lvns[i] < hi - vp.binSize / 2) return true;
    return false;
  }
  /** Playbook target rule: T1 = near edge of the first HVN / VAH / VAL / naked
      POC that lies ACROSS an LVN from entry (the auction has to traverse thin
      volume to reach it); T2 = the next node beyond T1. A node touching the
      entry's own volume shelf is not a target — that was the bug that priced
      every card at 0.3R. Fallbacks, in order: first node ≥ 1.5R away when the
      risk is known (so the RR band is at least reachable), else the nearest
      node — and the RR gate then fails honestly. opts.risk optional. */
  function targets(ctx, entry, dir, opts){
    opts = opts || {};
    var vp = ctx.vp4h, cands = [], i;
    function add(level, label){
      if (!isFinite(level)) return;
      if (dir === 'long' ? level <= entry + ctx.atr1h * 0.15 : level >= entry - ctx.atr1h * 0.15) return;
      cands.push({ level: level, label: label });
    }
    if (vp){
      add(vp.pocPrice, 'POC'); add(vp.vah, 'VAH'); add(vp.val, 'VAL');
      var hz = zones(vp.hvnsStrict && vp.hvnsStrict.length ? vp.hvnsStrict : (vp.hvns || []), vp.binSize);
      for (i = 0; i < hz.length; i++) add(dir === 'long' ? hz[i].lo : hz[i].hi, 'HVN ' + px(hz[i].lo) + '–' + px(hz[i].hi));
    }
    if (ctx.nakedPoc) add(ctx.nakedPoc.level, 'naked POC ' + ctx.nakedPoc.day);
    if (ctx.asia){ add(ctx.asia.hi, 'Asia high'); add(ctx.asia.lo, 'Asia low'); }
    if (ctx.pd){ add(ctx.pd.hi, 'PDH'); add(ctx.pd.lo, 'PDL'); }
    if (ctx.pw){ add(ctx.pw.hi, 'PWH'); add(ctx.pw.lo, 'PWL'); }
    cands.sort(function(a, b){ return dir === 'long' ? a.level - b.level : b.level - a.level; });
    /* dedupe within one row */
    var out = [];
    for (i = 0; i < cands.length; i++){
      if (out.length && Math.abs(out[out.length - 1].level - cands[i].level) < ROW_USD) continue;
      out.push(cands[i]);
    }
    var risk = isFinite(opts.risk) && opts.risk > 0 ? opts.risk : NaN;
    var t1i = -1, rule = 'none';
    for (i = 0; i < out.length; i++){ if (lvnBetween(entry, out[i].level, vp)){ t1i = i; rule = 'first node across an LVN'; break; } }
    if (t1i < 0 && isFinite(risk)){ for (i = 0; i < out.length; i++){ if (Math.abs(out[i].level - entry) >= 1.5 * risk){ t1i = i; rule = 'first node ≥ 1.5R (no LVN corridor)'; break; } } }
    if (t1i < 0 && out.length){ t1i = 0; rule = 'nearest node (no LVN corridor, none ≥ 1.5R)'; }
    var t1 = t1i >= 0 ? out[t1i] : null, t2 = t1i >= 0 ? (out[t1i + 1] || null) : null;
    if (t1) t1.rule = rule;
    return { t1: t1, t2: t2, ladder: out.slice(0, 5), rule: rule };
  }

  function buildCandidate(ctx, src){
    var dir = src.dir, level = src.level, atr = ctx.atr1h;
    var buf = Math.max(STOP_BUF_MIN_USD, 0.25 * atr);
    var entryOff = Math.max(STOP_BUF_MIN_USD, 0.1 * atr);
    var entry = isFinite(src.entry) ? src.entry : (dir === 'long' ? level + entryOff : level - entryOff);
    /* the retest limit belongs INSIDE the sweep candle (the order block), never
       beyond the pool: clamp pool+offset into [pool, sweep-candle body top] */
    var sbZone = src.sweep && isFinite(src.sweep.sweepI) ? sweepOb(ctx.rows1h, src.sweep.sweepI, dir) : null;
    if (sbZone && !isFinite(src.entry)){
      if (dir === 'long') entry = Math.min(entry, sbZone.hi); else entry = Math.max(entry, sbZone.lo);
    }
    var wick = isFinite(src.wick) ? src.wick : level;
    var stop = isFinite(src.stop) ? src.stop : (dir === 'long' ? wick - buf : wick + buf);
    var risk = Math.abs(entry - stop);
    var tg = targets(ctx, entry, dir, { risk: risk });
    var t1 = tg.t1 ? tg.t1.level : NaN, t2 = tg.t2 ? tg.t2.level : NaN;
    if (isFinite(src.t1)) t1 = src.t1;
    var rr1 = risk > 0 && isFinite(t1) ? Math.abs(t1 - entry) / risk : NaN;
    var rr2 = risk > 0 && isFinite(t2) ? Math.abs(t2 - entry) / risk : NaN;
    /* Order block for a sweep setup (Playbook P1 §6.1): the candle that took
       the pool is the last opposing candle before the displacement reclaim, so
       ITS wick+body is the block the retest must land in. A detector that
       waits for a separate ≥1.5×ATR displacement bar rejected 71 of 72 real
       sweeps and made G6 / location A unreachable. */
    var ob = dir === 'long' ? ctx.obs.bull : ctx.obs.bear, obSrc = ob ? 'fresh OB' : null;
    if (sbZone){
      var inSb = entry >= sbZone.lo - atr * 0.1 && entry <= sbZone.hi + atr * 0.1;
      var inFresh = !!(ob && entry >= ob.lo - atr * 0.1 && entry <= ob.hi + atr * 0.1);
      if (inSb && !inFresh){ ob = { lo: sbZone.lo, hi: sbZone.hi, age: src.age, mid: (sbZone.lo + sbZone.hi) / 2 }; obSrc = 'sweep-candle OB'; }
    }
    var obOk = !!(ob && entry >= ob.lo - atr * 0.1 && entry <= ob.hi + atr * 0.1);
    var loc = locationGrade(ctx, entry, dir, obOk, true);
    var c = {
      sid: src.sid, name: src.name, dir: dir, level: level, kind: src.kind, entry: entry, stop: stop, wick: wick,
      risk: risk, t1: t1, t2: t2, t1Label: tg.t1 ? tg.t1.label : (isFinite(src.t1) ? 'engine T1' : 'unavailable'),
      t2Label: tg.t2 ? tg.t2.label : 'unavailable', rr1: rr1, rr2: rr2, grade: loc.grade, gradeWhy: loc.why,
      obOk: obOk, ob: ob, obSrc: obSrc, sweep: src.sweep || null, age: isFinite(src.age) ? src.age : NaN,
      reclaimed: !!src.reclaimed, acceptance: !!src.acceptance, breach: fin(src.breach), engine: src.engine || 'local',
      gates: [], gatesPass: 0, families: null, vetoes: [], held: false
    };
    /* 12 core gates */
    var g = c.gates;
    function gate(n, name, pass, note){ g.push({ n: n, name: name, pass: !!pass, note: note || '' }); if (pass) c.gatesPass++; }
    var bias = ctx.bias;
    gate(1, '4H bias defined', bias.bias !== 'NO TRADE', bias.bias + (bias.transition ? ' (TRANSITION)' : ''));
    var dirOk = bias.bias === 'BOTH' ? (loc.grade === 'A' || loc.grade === 'B+' || ctx.atVaEdge) : bias.bias === up(dir);
    gate(2, 'Direction matches 4H bias', dirOk, up(dir) + ' vs bias ' + bias.bias);
    gate(3, 'Location A or B+', loc.grade === 'A' || loc.grade === 'B+', loc.grade + ' — ' + loc.why);
    var minBreach = Math.max(0.5, 0.05 * atr);
    gate(4, 'Liquidity pool swept', isFinite(c.breach) && c.breach >= minBreach, isFinite(c.breach) ? (c.kind + ' breach $' + num(c.breach) + ' (min $' + num(minBreach) + ')') : 'no sweep');
    var dispAtr = c.sweep ? fin(c.sweep.displacementAtr) : NaN, dispOk = !isFinite(dispAtr) || dispAtr >= 0.5;
    gate(5, 'Close back inside ≤ 3 bars with displacement ≥ 0.5 × ATR', c.reclaimed && c.age <= MAX_SWEEP_AGE && dispOk,
      c.reclaimed ? ('reclaim closed, sweep age ' + c.age + (isFinite(dispAtr) ? ' · displacement ' + num(dispAtr, 2) + ' × ATR' + (dispOk ? '' : ' (weak — no follow-through)') : '')) : 'reclaim not closed');
    gate(6, 'Rejection overlaps OB', obOk, ob ? ((obSrc || 'OB') + ' ' + px(ob.lo) + '–' + px(ob.hi) + (obOk ? ' overlaps entry' : ' does not overlap entry')) : 'no ' + dir + ' OB (no sweep candle, no fresh block)');
    gate(7, 'Session London/NY · no news lock', ctx.session.tradeable && !ctx.news.lock, ctx.session.label + (ctx.news.lock ? ' · NEWS LOCK' : ''));
    var lvn = lvnBetween(entry, t1, ctx.vp4h);
    gate(8, 'LVN between entry and T1', lvn, lvn ? 'LVN corridor between entry and T1' : 'no LVN path / same node');
    gate(9, 'RR to T1 ≥ 2.0', isFinite(rr1) && rr1 >= 1.5, isFinite(rr1) ? (num(rr1) + 'R' + (rr1 < 2 && rr1 >= 1.5 ? ' (half-size band)' : '')) : 'no T1');
    var rCap = 0.6 * ctx.atr4h;
    gate(10, 'R ≤ 0.6 × 4H ATR', isFinite(rCap) && risk <= rCap, 'R $' + num(risk) + ' vs cap $' + num(rCap));
    gate(11, 'Price feed sane', ctx.feed.ok, ctx.feed.why);
    gate(12, 'Not second stop of day', !(ctx.dayStops >= 2), isFinite(ctx.dayStops) ? ('stops today ' + ctx.dayStops) : 'stops today unavailable — passes with note');
    c.halfBand = isFinite(rr1) && rr1 >= 1.5 && rr1 < 2;
    /* evidence families — one vote each, only where data exists */
    var fam = [], agree = 0, total = 0;
    function vote(name, state, note){ fam.push({ name: name, state: state, note: note }); if (state !== 'unavailable'){ total++; if (state === 'agree') agree++; } }
    vote('structure', 'agree', c.kind + ' swept and ' + (c.reclaimed ? 'reclaimed' : 'not yet reclaimed'));
    vote('flow', ctx.pocStep === 'unavailable' ? 'unavailable' : (ctx.pocStep === (dir === 'long' ? 'UP' : 'DOWN') ? 'agree' : (ctx.pocStep === 'FLAT' ? 'neutral' : 'oppose')), 'session POCs ' + ctx.pocStep);
    vote('trend', ctx.emaSlope === 'unavailable' ? 'unavailable' : (ctx.emaSlope === (dir === 'long' ? 'UP' : 'DOWN') ? 'agree' : (ctx.emaSlope === 'FLAT' ? 'neutral' : 'oppose')), 'EMA20/50 4H ' + ctx.emaSlope);
    var momVeto = dir === 'long' ? ctx.rsiVeto.longVeto : ctx.rsiVeto.shortVeto;
    var momAgree = dir === 'long' ? ctx.struct1h.higherLows : ctx.struct1h.lowerHighs;
    vote('momentum', !isFinite(ctx.rsi4h) ? 'unavailable' : (momVeto ? 'oppose' : (momAgree ? 'agree' : 'neutral')), 'RSI4H ' + num(ctx.rsi4h, 1) + (momVeto ? ' exhaustion veto' : '') + (momAgree ? (dir === 'long' ? ' · 1H higher lows' : ' · 1H lower highs') : ''));
    vote('volatility', !isFinite(ctx.adrUsed) ? 'unavailable' : (ctx.adrUsed < 100 && risk <= rCap ? 'agree' : 'oppose'), 'ADR used ' + num(ctx.adrUsed, 0) + '% · ATR regime ' + ctx.atrRegime);
    vote('positioning', ctx.funding.state === 'unavailable' ? 'unavailable' : (isFinite(ctx.funding.value) ? ((dir === 'long' ? ctx.funding.value <= 0 : ctx.funding.value >= 0) ? 'agree' : 'oppose') : 'neutral'), 'funding ' + (isFinite(ctx.funding.value) ? num(ctx.funding.value, 4) + '%' : 'unavailable') + ' (' + ctx.funding.state + ')');
    vote('macro', ctx.dxy.state === 'unavailable' ? 'unavailable' : (ctx.dxy.dir === (dir === 'long' ? 'DOWN' : 'UP') ? 'agree' : (ctx.dxy.dir === 'FLAT' ? 'neutral' : 'oppose')), 'DXY ' + ctx.dxy.dir + ' (' + ctx.dxy.state + ')');
    c.families = { votes: fam, agree: agree, total: total };
    /* hard vetoes (Step 4) */
    if (momVeto) c.vetoes.push('RSI exhaustion veto against ' + up(dir));
    if (ctx.news.lock) c.vetoes.push('news lockout');
    if (!ctx.feed.ok) c.vetoes.push('data quality');
    if (ctx.dayStops >= 2) c.vetoes.push('two stops already today');
    if (src.kerClass && !src.kerOk) c.vetoes.push('KER-disabled class');
    if (src.continuation && ctx.adrUsed > 120) c.vetoes.push('ADR used > 120% for continuation');
    if (ctx.tape && ctx.tape !== dir){ c.held = true; c.vetoes.push('against gold tape ' + (ctx.tape === 'long' ? 'UP' : 'DOWN') + ' — HELD'); }
    return c;
  }

  function rankCandidates(list){
    list.sort(function(a, b){
      if (b.gatesPass !== a.gatesPass) return b.gatesPass - a.gatesPass;
      if (gradeRank(b.grade) !== gradeRank(a.grade)) return gradeRank(b.grade) - gradeRank(a.grade);
      var ra = isFinite(a.rr1) ? a.rr1 : -1, rb = isFinite(b.rr1) ? b.rr1 : -1;
      if (rb !== ra) return rb - ra;
      return (b.families.agree - a.families.agree);
    });
    return list;
  }

  /* ---------------- engine-sourced candidates (when goldind is loaded) ---------------- */
  var ENGINE_SID = { 'asia-london': 'S0', 'liq-sweep': 'S0', 'sweep-ob': 'S0', 'silverb': 'S0', 'pdh-pdl-ny': 'S0',
                     'ny-exhaustion': 'S14', 'vpbook': 'S0' };
  function engineCandidates(ctx, stack){
    var out = [], i, s;
    if (!stack || !Array.isArray(stack.strategies)) return out;
    for (i = 0; i < stack.strategies.length; i++){
      s = stack.strategies[i];
      if (!s || !s.dir || !isFinite(fin(s.level))) continue;
      var sid = ENGINE_SID[s.key];
      if (!sid) continue;
      out.push({ sid: sid, name: 'engine ' + s.key, dir: s.dir, level: fin(s.level), kind: s.key,
                 stop: s.plan && isFinite(fin(s.plan.stop)) ? fin(s.plan.stop) : (isFinite(fin(s.invalidates)) ? fin(s.invalidates) : NaN),
                 entry: s.plan && isFinite(fin(s.plan.entry)) ? fin(s.plan.entry) : NaN,
                 t1: isFinite(fin(s.t1)) ? fin(s.t1) : NaN, engine: s.key,
                 age: 0, reclaimed: s.grade === 'confirmed', breach: NaN, continuation: sid === 'S3' || sid === 'S5' });
    }
    return out;
  }

  /* ---------------- macro / positioning reads ---------------- */
  function dxyRead(inp){
    var rows = normRows(inp.dxyRows || (inp.macro && inp.macro.dxyRows));
    if (rows.length >= 2){
      var k = dayKey(rows[rows.length - 1].t), o = NaN, i;
      for (i = 0; i < rows.length; i++) if (dayKey(rows[i].t) === k){ o = rows[i].o; break; }
      var c = rows[rows.length - 1].c, chg = isFinite(o) && o > 0 ? (c - o) / o * 100 : NaN;
      return { state: 'live', dir: !isFinite(chg) ? 'FLAT' : chg > 0.1 ? 'UP' : chg < -0.1 ? 'DOWN' : 'FLAT', chgPct: chg, value: c };
    }
    var m = inp.macro || {};
    var t = m.dxyTrend || (m.dxy && m.dxy.trend) || m.dollarTrend;
    if (t) return { state: 'proxy', dir: up(t).indexOf('UP') >= 0 ? 'UP' : up(t).indexOf('DOWN') >= 0 ? 'DOWN' : 'FLAT', chgPct: NaN, value: fin(m.dxy && m.dxy.last) };
    return { state: 'unavailable', dir: 'unavailable', chgPct: NaN, value: NaN };
  }
  function fundingRead(inp){
    var pn = inp.perpNative;
    if (pn && Array.isArray(pn.funding) && pn.funding.length){
      var last = pn.funding[pn.funding.length - 1];
      var v = fin(last && (last.rate != null ? last.rate : (last.fundingRate != null ? last.fundingRate : last.v)));
      if (isFinite(v)) return { state: 'live', value: Math.abs(v) < 0.01 ? v * 100 : v, src: 'Delta XAUTUSD' };
    }
    if (isFinite(fin(inp.fundingRate))) return { state: 'proxy', value: fin(inp.fundingRate), src: 'Binance PAXGUSDT' };
    return { state: 'unavailable', value: NaN, src: '' };
  }
  function oiRead(inp){
    var pn = inp.perpNative;
    if (pn && Array.isArray(pn.oi) && pn.oi.length >= 2){
      var a = pn.oi[pn.oi.length - 1], b = null, i, tLast = fin(a && a.t);
      if (tLast < 1e12) tLast *= 1000;
      for (i = pn.oi.length - 2; i >= 0; i--){
        var t = fin(pn.oi[i].t); if (t < 1e12) t *= 1000;
        if (tLast - t >= 23 * 3600000){ b = pn.oi[i]; break; }
      }
      if (!b) b = pn.oi[0];
      var va = fin(a.oi != null ? a.oi : a.v), vb = fin(b.oi != null ? b.oi : b.v);
      if (isFinite(va) && isFinite(vb) && vb > 0) return { state: 'live', chgPct: (va - vb) / vb * 100, src: 'Delta XAUTUSD' };
    }
    return { state: 'unavailable', chgPct: NaN, src: '' };
  }
  function scalarRead(v, srcLabel){
    v = fin(v);
    return isFinite(v) ? { state: 'live', value: v, src: srcLabel } : { state: 'unavailable', value: NaN, src: '' };
  }

  /* ---------------- sizing ---------------- */
  function sizing(ctx, c){
    var out = { equity: fin(ctx.equity), riskUsd: NaN, oz: NaN, gc: NaN, mgc: NaN, pick: 'unavailable', leverage: NaN, liq: 'unavailable', per10k: '' };
    if (!(c.risk > 0)) return out;
    var per10kOz = 100 / c.risk;
    out.per10k = 'per $10,000 at 1%: ' + num(per10kOz, 2) + ' oz (MGC×' + Math.floor(per10kOz / 10) + ')';
    if (!(out.equity > 0)){ out.pick = 'account size missing — set hg_gold_equity (Settings) or pass equity'; return out; }
    out.riskUsd = out.equity * 0.01;
    out.oz = out.riskUsd / c.risk;
    out.gc = Math.floor(out.oz / 100);
    out.mgc = Math.floor(out.oz / 10);
    var f = gfn('hgGoldVpContractSize');
    if (f){ try{ var r = f(c.risk, { equity: out.equity, riskPct: 0.01, entry: c.entry }); if (r && r.pick) out.pick = r.pick; }catch(e){} }
    if (out.pick === 'unavailable') out.pick = out.gc >= 1 ? ('GC×' + out.gc) : (out.mgc >= 1 ? ('MGC×' + out.mgc) : 'sub-lot — reduce risk');
    var notional = out.oz * c.entry;
    out.leverage = out.equity > 0 ? notional / out.equity : NaN;
    return out;
  }

  /* ================================================================== */
  /*                              ENGINE                                */
  /* ================================================================== */
  function hgGoldSevenStep(inp){
    inp = inp || {};
    var nowMs = isFinite(fin(inp.now)) ? fin(inp.now) : Date.now();
    var out = { ok: false, status: 'DATA_UNAVAILABLE', why: '', now: nowMs, nowIst: istUtcDay(nowMs),
                feed: null, steps: {}, summary: [], disclaimer: 'Rule-based checklist, not advice. Enter only on your own review.' };

    /* ---- feed + closed bars ---- */
    var rows1h = closedRows(inp.rows1h, HOUR, nowMs);
    var derived4h = false;
    if (!rows1h.length && Array.isArray(inp.rows15m) && inp.rows15m.length){
      var m15 = closedRows(inp.rows15m, 900, nowMs), bk = {}, ord = [], i0, r0, b0;
      for (i0 = 0; i0 < m15.length; i0++){
        r0 = m15[i0]; b0 = Math.floor(r0.t / HOUR) * HOUR;
        if (!bk[b0]){ bk[b0] = { t: b0, o: r0.o, h: r0.h, l: r0.l, c: r0.c, v: r0.v, n: 1 }; ord.push(b0); }
        else { var kk = bk[b0]; if (r0.h > kk.h) kk.h = r0.h; if (r0.l < kk.l) kk.l = r0.l; kk.c = r0.c; kk.v += r0.v; kk.n++; }
      }
      for (i0 = 0; i0 < ord.length; i0++){ if (bk[ord[i0]].n === 4) rows1h.push(bk[ord[i0]]); }
      rows1h = closedRows(rows1h, HOUR, nowMs);
    }
    var rows4h = closedRows(inp.rows4h, H4, nowMs);
    if (rows4h.length < 60 && rows1h.length >= 8){ rows4h = derive4h(rows1h, nowMs); derived4h = true; }
    var feedName = inp.feed || inp.source || (inp.src && (inp.src['1h'] || inp.src['4h'])) || 'unavailable';
    var venue = inp.venue || 'analysis feed';
    var basis = fin(inp.basisPct);
    out.feed = { name: String(feedName), venue: String(venue), bars1h: rows1h.length, bars4h: rows4h.length, derived4h: derived4h,
                 lastCloseMs: rows1h.length ? (rows1h[rows1h.length - 1].t + HOUR) * 1000 : NaN, basisPct: basis };
    if (rows1h.length < MIN_1H_BARS){
      out.why = 'need ≥ ' + MIN_1H_BARS + ' closed 1H bars (have ' + rows1h.length + ') — paste the 400 × 1H OHLCV block or wait for the 1H leg';
      out.summary = ['DATA_UNAVAILABLE — ' + out.why, out.disclaimer];
      return out;
    }
    var lastCloseMs = out.feed.lastCloseMs;
    if (nowMs - lastCloseMs > STALE_MS){
      out.why = 'feed stale — last closed 1H bar ' + istUtcDay(lastCloseMs) + ' is ' + num((nowMs - lastCloseMs) / 3600000, 1) + 'h old (limit 2h)';
      out.summary = ['DATA_UNAVAILABLE — ' + out.why, out.disclaimer];
      return out;
    }
    if (isFinite(basis) && Math.abs(basis) > BASIS_ABNORMAL_PCT){
      out.why = 'venue basis abnormal — ' + num(basis) + '% vs analysis feed (limit ±' + BASIS_ABNORMAL_PCT + '%)';
      out.summary = ['DATA_UNAVAILABLE — ' + out.why, out.disclaimer];
      return out;
    }
    /* a gap of a full day inside the last 400 bars means a missing day */
    var gi, maxGap = 0;
    for (gi = Math.max(1, rows1h.length - 400); gi < rows1h.length; gi++){ var gp = rows1h[gi].t - rows1h[gi - 1].t; if (gp > maxGap) maxGap = gp; }
    if (maxGap > 3 * 86400){
      out.why = 'feed missing a day — ' + num(maxGap / 86400, 1) + '-day hole inside the 1H series';
      out.summary = ['DATA_UNAVAILABLE — ' + out.why, out.disclaimer];
      return out;
    }
    out.status = 'OK'; out.ok = true;

    /* ---- STEP 1 ---- */
    var ctx = { now: nowMs, rows1h: rows1h, rows4h: rows4h, tape: null, equity: fin(inp.equity), dayStops: fin(inp.dayStops) };
    if (!(ctx.equity > 0)){
      try{ ctx.equity = fin(W.__hgGoldEquity); }catch(e0){}
      if (!(ctx.equity > 0)){ try{ ctx.equity = fin(W.localStorage && W.localStorage.getItem('hg_gold_equity')); }catch(e1){} }
    }
    var tapeIn = up(inp.tape || inp.deskTape);
    if (tapeIn === 'UP' || tapeIn === 'LONG') ctx.tape = 'long';
    if (tapeIn === 'DOWN' || tapeIn === 'SHORT') ctx.tape = 'short';
    ctx.atr1h = atrN(rows1h, 14); ctx.atr4h = atrN(rows4h, 14);
    var atr50 = atrN(rows4h, 50), atrRatio = isFinite(atr50) && atr50 > 0 ? ctx.atr4h / atr50 : NaN;
    ctx.atrRegime = !isFinite(atrRatio) ? 'unavailable' : atrRatio < 0.8 ? 'compressed' : atrRatio > 1.25 ? 'expanded' : 'normal';
    var adr = adr10(rows1h); ctx.adrUsed = adr.used;
    ctx.ker = ker20(rows4h);
    ctx.rsi4h = rsi14(rows4h);
    ctx.struct1h = structure1h(rows1h);
    var e20 = emaSeries(closes(rows4h), 20), e50 = emaSeries(closes(rows4h), 50), n4 = rows4h.length;
    var s20 = n4 > 4 ? e20[n4 - 1] - e20[n4 - 4] : NaN, s50 = n4 > 4 ? e50[n4 - 1] - e50[n4 - 4] : NaN;
    var slopeTol = isFinite(ctx.atr4h) ? 0.1 * ctx.atr4h : 0.5;
    ctx.emaSlope = !isFinite(s20) || !isFinite(s50) ? 'unavailable'
      : (s20 > slopeTol && s50 > 0) ? 'UP' : (s20 < -slopeTol && s50 < 0) ? 'DOWN' : 'FLAT';
    ctx.session = goldSession(nowMs);
    ctx.news = newsRead(inp.news, nowMs);
    ctx.dxy = dxyRead(inp); ctx.funding = fundingRead(inp); ctx.oi = oiRead(inp);
    ctx.gvz = scalarRead(inp.gvz != null ? inp.gvz : (inp.macro && inp.macro.gvz), 'GVZ');
    ctx.cot = scalarRead(inp.cotPct != null ? inp.cotPct : (inp.macro && inp.macro.cotMmPct), 'COT managed-money percentile');
    ctx.shanghai = scalarRead(inp.shanghaiPremium != null ? inp.shanghaiPremium : (inp.macro && inp.macro.shanghaiPremium), 'Shanghai premium');
    ctx.dr = dealingRange(rows4h);
    ctx.vp4h = ctx.dr ? volProfile(ctx.dr.rows, ROW_USD) : volProfile(rows4h.slice(-60), ROW_USD);
    ctx.vpWeek = volProfile(rows1h.slice(-120), ROW_USD);
    ctx.pocs = sessionPocs(rows1h, 3); ctx.pocStep = pocStep(ctx.pocs);
    ctx.asia = asiaRange(rows1h, nowMs); ctx.pd = priorDay(rows1h); ctx.pw = priorWeek(rows1h);
    ctx.eq = equalExtremes(rows1h, EQ_TOL_USD);
    ctx.obs = freshObs(rows1h, ctx.atr1h);
    var dn = rows1h.slice(-21, -1), dhi = -Infinity, dlo = Infinity, di;
    for (di = 0; di < dn.length; di++){ if (dn[di].h > dhi) dhi = dn[di].h; if (dn[di].l < dlo) dlo = dn[di].l; }
    ctx.donchian = dn.length >= 20 ? { hi: dhi, lo: dlo } : null;
    /* naked POC: prior session POC never traded through since */
    ctx.nakedPoc = null;
    if (ctx.pocs.length >= 2){
      var pp = ctx.pocs[ctx.pocs.length - 2], touched = false, ti;
      for (ti = rows1h.length - 1; ti >= 0 && dayKey(rows1h[ti].t) > dayKey(rows1h[0].t); ti--){
        if (new Date(rows1h[ti].t * 1000).toISOString().slice(0, 10) === pp.day) break;
        if (rows1h[ti].l <= pp.poc && rows1h[ti].h >= pp.poc){ touched = true; break; }
      }
      if (!touched) ctx.nakedPoc = { level: pp.poc, day: pp.day };
    }
    var lastPx = rows1h[rows1h.length - 1].c;
    ctx.lastPx = lastPx;
    ctx.vaPos = ctx.vp4h ? (lastPx > ctx.vp4h.vah ? 'ABOVE VA' : lastPx < ctx.vp4h.val ? 'BELOW VA' : 'INSIDE VA') : 'unavailable';
    ctx.atVaEdge = !!(ctx.vp4h && (Math.abs(lastPx - ctx.vp4h.vah) <= 0.35 * ctx.atr1h || Math.abs(lastPx - ctx.vp4h.val) <= 0.35 * ctx.atr1h));
    ctx.weekVaPos = ctx.vpWeek ? (lastPx > ctx.vpWeek.vah ? 'ABOVE' : lastPx < ctx.vpWeek.val ? 'BELOW' : 'INSIDE') : 'unavailable';
    ctx.feed = { ok: true, why: out.feed.name + ' · last closed 1H ' + fmtHM(lastCloseMs, 'UTC') + ' UTC' };
    ctx.rsiVeto = {
      longVeto: isFinite(ctx.rsi4h) && ctx.rsi4h > 70 && ctx.struct1h.lowerHighs,
      shortVeto: isFinite(ctx.rsi4h) && ctx.rsi4h < 30 && ctx.struct1h.higherLows
    };
    /* acceptance flag (for S37 eligibility) is read from the sweep scan below */
    var pl = pools(ctx), sweeps = [], si;
    for (si = 0; si < pl.length; si++){ var sr = sweepRead(rows1h, pl[si], ctx.atr1h); if (sr) sweeps.push(sr); }
    ctx.acceptance = sweeps.some(function(s){ return s.acceptance; });
    var elig = eligibility(ctx);

    out.steps.s1 = {
      feed: out.feed, lastPx: lastPx,
      vp: ctx.vp4h ? { poc: ctx.vp4h.pocPrice, vah: ctx.vp4h.vah, val: ctx.vp4h.val,
                       hvn: zones(ctx.vp4h.hvnsStrict && ctx.vp4h.hvnsStrict.length ? ctx.vp4h.hvnsStrict : (ctx.vp4h.hvns || []), ctx.vp4h.binSize),
                       lvn: zones(ctx.vp4h.lvns || [], ctx.vp4h.binSize), rowUsd: ctx.vp4h.binSize,
                       volumeTrusted: ctx.vp4h.volumeTrusted !== false } : null,
      dealingRange: ctx.dr ? { hi: ctx.dr.hi, lo: ctx.dr.lo, eq: ctx.dr.eq, half: ctx.dr.half } : null,
      sessionPocs: ctx.pocs, pocStep: ctx.pocStep, asia: ctx.asia, pd: ctx.pd, pw: ctx.pw, eq: ctx.eq, obs: ctx.obs,
      atr1h: ctx.atr1h, atr4h: ctx.atr4h, atrRatio: atrRatio, atrRegime: ctx.atrRegime, adr: adr,
      rsi4h: ctx.rsi4h, struct1h: ctx.struct1h, emaSlope: ctx.emaSlope, ker: ctx.ker,
      kerLabel: !isFinite(ctx.ker) ? 'unavailable' : ctx.ker > 0.6 ? 'trend' : ctx.ker < 0.3 ? 'chop' : 'mixed',
      session: ctx.session, news: ctx.news, dxy: ctx.dxy, funding: ctx.funding, oi: ctx.oi, gvz: ctx.gvz, cot: ctx.cot, shanghai: ctx.shanghai,
      eligible: elig.eligible, disabled: elig.disabled, nakedPoc: ctx.nakedPoc, tape: ctx.tape
    };

    /* ---- STEP 2 ---- */
    var bias = { bias: 'BOTH', transition: false, why: [] };
    var mig = ctx.pocStep, ema = ctx.emaSlope;
    if ((mig === 'UP' && ema === 'DOWN') || (mig === 'DOWN' && ema === 'UP')){
      bias.bias = 'NO TRADE'; bias.transition = true; bias.why.push('EMA slope ' + ema + ' disagrees with POC migration ' + mig + ' — TRANSITION → WAIT');
    } else if (ctx.vaPos === 'ABOVE VA' && ema !== 'DOWN' && mig !== 'DOWN'){
      bias.bias = 'LONG'; bias.why.push('price above VAH, POC migration ' + mig + ', EMA ' + ema);
    } else if (ctx.vaPos === 'BELOW VA' && ema !== 'UP' && mig !== 'UP'){
      bias.bias = 'SHORT'; bias.why.push('price below VAL, POC migration ' + mig + ', EMA ' + ema);
    } else if (mig === 'UP' && ema === 'UP'){
      bias.bias = 'LONG'; bias.why.push('POC stepping UP with EMA UP — inside value, buy discount');
    } else if (mig === 'DOWN' && ema === 'DOWN'){
      bias.bias = 'SHORT'; bias.why.push('POC stepping DOWN with EMA DOWN — inside value, sell premium');
    } else {
      bias.bias = 'BOTH'; bias.why.push('balanced value — POC ' + mig + ', EMA ' + ema + ' — trade VA edges only');
    }
    if (ctx.vp4h && ctx.vp4h.lvns && ctx.vp4h.lvns.length){
      var midLvn = ctx.vp4h.lvns.some(function(l){ return Math.abs(lastPx - l) < ctx.vp4h.binSize; });
      var nearHvn = (ctx.vp4h.hvns || []).some(function(h){ return Math.abs(lastPx - h) < ctx.vp4h.binSize * 3; });
      if (midLvn && !nearHvn && bias.bias === 'BOTH'){ bias.bias = 'NO TRADE'; bias.why.push('price sitting mid-LVN with no node to react from'); }
    }
    bias.why.push('dealing range ' + (ctx.dr ? ctx.dr.half + ' half (' + num(ctx.dr.pct * 100, 0) + '% of ' + px(ctx.dr.lo) + '–' + px(ctx.dr.hi) + ')' : 'unavailable'));
    bias.why.push('weekly VA: price ' + ctx.weekVaPos);
    if (ctx.tape) bias.why.push('desk gold tape ' + up(ctx.tape === 'long' ? 'UP' : 'DOWN') + ' — against-tape candidates are HELD');
    bias.rsiVeto = ctx.rsiVeto.longVeto ? 'LONG veto active (4H RSI ' + num(ctx.rsi4h, 1) + ' > 70 with 1H lower highs)'
      : ctx.rsiVeto.shortVeto ? 'SHORT veto active (4H RSI ' + num(ctx.rsi4h, 1) + ' < 30 with 1H higher lows)'
      : (isFinite(ctx.rsi4h) ? 'none (4H RSI ' + num(ctx.rsi4h, 1) + ')' : 'unavailable');
    ctx.bias = bias;
    out.steps.s2 = bias;

    /* ---- STEP 3 ---- */
    var srcs = [], ci;
    var eligIds = {}; for (ci = 0; ci < elig.eligible.length; ci++) eligIds[elig.eligible[ci].id] = elig.eligible[ci].role;
    for (si = 0; si < sweeps.length; si++){
      var sw = sweeps[si], sid = sw.pool.sid;
      if (sw.acceptance){
        if (eligIds.S37){
          var cdir = sw.dir === 'long' ? 'short' : 'long';
          /* continuation through the failed pool: the stop belongs beyond the
             pool the reclaim failed at, not beyond the last bar's wick */
          srcs.push({ sid: 'S37', name: 'failed-sweep continuation through ' + sw.pool.kind, dir: cdir, level: sw.pool.level, kind: sw.pool.kind + ' acceptance',
                      wick: sw.pool.level, age: sw.age, reclaimed: true, acceptance: true, breach: sw.breach, continuation: true });
        }
        continue;
      }
      if (!eligIds[sid] && !(sid === 'S19' && eligIds.S19)) continue;
      srcs.push({ sid: sid, name: (sid === 'S0' ? 'AMD sweep → reclaim' : sid === 'S20' ? 'turtle soup' : 'spring / UTAD') + ' at ' + sw.pool.kind,
                  dir: sw.dir, level: sw.pool.level, kind: sw.pool.kind, wick: sw.wick, age: sw.age, reclaimed: sw.reclaimed, breach: sw.breach, sweep: sw });
    }
    var stack = null;
    try{
      var fs = gfn('hgGoldFormingStack');
      if (fs && inp.engineStack !== false) stack = inp.stack || fs({ rows: rows1h, rows1h: rows1h, rows4h: rows4h, macro: inp.macro, news: inp.news, now: nowMs,
                                                                  perpNative: inp.perpNative, tf: '1h' });
    }catch(eS){ stack = null; }
    var eng = engineCandidates(ctx, stack);
    for (ci = 0; ci < eng.length; ci++){
      if (!eligIds[eng[ci].sid]) continue;
      var dup = srcs.some(function(s){ return s.dir === eng[ci].dir && Math.abs(s.level - eng[ci].level) < ROW_USD; });
      if (!dup) srcs.push(eng[ci]);
    }
    var cands = [];
    for (ci = 0; ci < srcs.length; ci++){ try{ cands.push(buildCandidate(ctx, srcs[ci])); }catch(eC){} }
    rankCandidates(cands);
    for (ci = 0; ci < cands.length; ci++) cands[ci].rank = ci + 1;
    out.steps.s3 = { candidates: cands, rankName: 'RULE-BASED CONFLUENCE RANK', poolsScanned: pl.length, sweepsSeen: sweeps.length, engine: !!stack };

    /* ---- STEP 4 ---- */
    var best = null, second = null, s4 = { best: null, second: null, disqualified: [], noSetup: false, why: '' };
    for (ci = 0; ci < cands.length; ci++){
      var cc = cands[ci];
      if (cc.vetoes.length){ s4.disqualified.push({ sid: cc.sid, dir: cc.dir, kind: cc.kind, why: cc.vetoes.join(' · ') }); continue; }
      if (cc.gatesPass < MIN_GATES_SETUP){ s4.disqualified.push({ sid: cc.sid, dir: cc.dir, kind: cc.kind, why: cc.gatesPass + '/' + CORE_GATES + ' core gates (< ' + MIN_GATES_SETUP + ')' }); continue; }
      if (!best) best = cc; else if (!second){ second = cc; break; }
    }
    if (!best){
      s4.noSetup = true;
      s4.why = cands.length ? 'no candidate passes ≥ ' + MIN_GATES_SETUP + '/' + CORE_GATES + ' core gates without a hard veto' : 'no eligible strategy has a sweep on the last ' + (MAX_SWEEP_AGE + 1) + ' closed 1H bars';
      s4.closest = cands.slice(0, 2).map(function(c){
        return { sid: c.sid, dir: c.dir, kind: c.kind, gatesPass: c.gatesPass, missing: c.gates.filter(function(g){ return !g.pass; }).map(function(g){ return 'G' + g.n + ' ' + g.name; }),
                 held: c.held, vetoes: c.vetoes, nextClose: nextCloseCondition(ctx, c) };
      });
    } else {
      s4.best = best;
      s4.second = second || null;
      s4.why = best.sid + ' ' + up(best.dir) + ' — ' + best.gatesPass + '/' + CORE_GATES + ' gates, location ' + best.grade + ', RR ' + num(best.rr1) + ', families ' + best.families.agree + '/' + best.families.total
        + (second ? (' — beat ' + second.sid + ' ' + up(second.dir) + ' (' + second.gatesPass + '/' + CORE_GATES + ', ' + second.grade + ', RR ' + num(second.rr1) + ')') : ' — no second candidate');
    }
    s4.nextRescan = nextRescan(nowMs);
    out.steps.s4 = s4;

    /* ---- STEP 5 ---- */
    if (best){
      var size = sizing(ctx, best);
      var mult = isFinite(basis) ? (1 + basis / 100) : 1;
      var conv = isFinite(basis) && venue !== 'analysis feed' ? {
        venue: venue, basisPct: basis, entry: best.entry * mult, stop: best.stop * mult, t1: best.t1 * mult, t2: best.t2 * mult
      } : null;
      out.steps.s5 = {
        dir: best.dir, entry: best.entry, entryCondition: entryCondition(ctx, best), stop: best.stop, risk: best.risk,
        stopWhy: 'beyond the sweep wick ' + px(best.wick) + ' + buffer max($2, 0.25 × 1H ATR ' + num(ctx.atr1h) + ') = $' + num(Math.max(STOP_BUF_MIN_USD, 0.25 * ctx.atr1h)),
        t1: best.t1, t1Label: best.t1Label, rr1: best.rr1, t2: best.t2, t2Label: best.t2Label, rr2: best.rr2,
        sizeBand: !isFinite(best.rr1) ? 'no setup' : best.rr1 >= 2 ? 'full size' : best.rr1 >= 1.5 ? 'half size' : 'no setup (RR < 1.5)',
        management: '50% at T1 and stop to entry · 30% at T2 · runner 20% trailed one node behind',
        timeStop: 'London close ' + istUtc(ctx.session.londonCloseMs) + ' if T1 not reached',
        invalidation: 'two 1H closes ' + (best.dir === 'long' ? 'below ' : 'above ') + px(best.level) + ' (' + best.kind + ') = acceptance — setup cancelled',
        size: size, venue: conv
      };
    } else out.steps.s5 = null;

    /* ---- STEP 6 ---- */
    if (best){
      var rows6 = best.gates.map(function(g){ return { gate: 'G' + g.n, name: g.name, result: g.pass ? 'PASS' : 'FAIL', note: g.note }; });
      var g14veto = best.dir === 'long' ? ctx.rsiVeto.longVeto : ctx.rsiVeto.shortVeto;
      rows6.push({ gate: 'G14', name: 'RSI exhaustion veto', result: g14veto ? 'FAIL' : 'PASS', note: bias.rsiVeto });
      rows6.push({ gate: 'G13', name: 'CVD confirms (optional)', result: inp.cvdDir ? (up(inp.cvdDir) === up(best.dir) ? 'PASS' : 'FAIL') : 'unavailable', note: inp.cvdDir ? ('CVD ' + up(inp.cvdDir)) : 'no CVD feed' });
      rows6.push({ gate: 'G15', name: 'Positioning (funding / OI) (optional)', result: ctx.funding.state === 'unavailable' ? 'unavailable' : (best.families.votes[5].state === 'agree' ? 'PASS' : 'FAIL'), note: best.families.votes[5].note });
      rows6.push({ gate: 'G16', name: 'Anchored VWAP side (optional)', result: 'unavailable', note: 'AVWAP not in this readout' });
      var coreFail = best.gates.filter(function(g){ return !g.pass; });
      var result = 'INVALID';
      if (!coreFail.length && !g14veto) result = 'VALID';
      else if (coreFail.length === 1 && coreFail[0].n === 9 && best.halfBand && !g14veto) result = 'VALID-HALF';
      var sane = [];
      var t1InHvn = false;
      if (ctx.vp4h){
        var hzz = zones(ctx.vp4h.hvnsStrict && ctx.vp4h.hvnsStrict.length ? ctx.vp4h.hvnsStrict : (ctx.vp4h.hvns || []), ctx.vp4h.binSize);
        t1InHvn = hzz.some(function(z){ return best.entry >= z.lo && best.entry <= z.hi && best.t1 >= z.lo && best.t1 <= z.hi; });
      }
      sane.push({ id: 'a', name: 'T1 not inside the same HVN as entry', pass: !t1InHvn });
      sane.push({ id: 'b', name: 'stop beyond the wick, not inside it', pass: best.dir === 'long' ? best.stop < best.wick : best.stop > best.wick });
      sane.push({ id: 'c', name: 'R ≤ 0.6 × 4H ATR', pass: best.risk <= 0.6 * ctx.atr4h });
      var holdEnd = ctx.session.londonCloseMs;
      var newsInHold = ctx.news.available && isFinite(ctx.news.nextMs) && ctx.news.nextMs > nowMs && ctx.news.nextMs < holdEnd && ctx.news.nextTier <= 2;
      sane.push({ id: 'd', name: 'no Tier 1/2 release inside the hold window', pass: !newsInHold, note: newsInHold ? ('lockout plan: flat or stop-to-entry before ' + ctx.news.window) : (ctx.news.available ? 'none before time stop' : 'calendar unavailable — check manually') });
      sane.push({ id: 'e', name: 'direction agrees with 4H bias (or BOTH at VA edge)', pass: bias.bias === up(best.dir) || (bias.bias === 'BOTH' && (best.grade === 'A' || best.grade === 'B+' || ctx.atVaEdge)) });
      sane.push({ id: 'f', name: 'feed current (≤ 2h) and venue basis normal', pass: true, note: out.feed.name + ' · basis ' + (isFinite(basis) ? num(basis) + '%' : 'n/a') });
      if (sane.some(function(s){ return !s.pass; })) result = 'INVALID';
      out.steps.s6 = { rows: rows6, result: result, failing: coreFail.map(function(g){ return 'G' + g.n; }).concat(g14veto ? ['G14'] : []), sanity: sane };
    } else out.steps.s6 = null;

    /* ---- STEP 7 ---- */
    out.steps.s7 = trigger(ctx, best, out.steps.s6, elig);

    /* ---- summary (≤ 15 lines, phone-fit) ---- */
    out.summary = summaryLines(out, ctx, best);
    return out;
  }

  function entryCondition(ctx, c){
    var nextClose = nextCloseMs(ctx);
    if (c.sid === 'S37') return '1H retest of ' + px(c.level) + ' after acceptance → limit ' + px(c.entry);
    return c.reclaimed
      ? ('1H already closed back ' + (c.dir === 'long' ? 'above ' : 'below ') + px(c.level) + ' (' + c.kind + ') → limit ' + px(c.entry))
      : ('1H close back ' + (c.dir === 'long' ? 'above ' : 'below ') + px(c.level) + ' (' + c.kind + ') at ' + istUtc(nextClose) + ' → limit ' + px(c.entry));
  }
  function nextCloseMs(ctx){ return (ctx.rows1h[ctx.rows1h.length - 1].t + 2 * HOUR) * 1000; }
  function nextCloseCondition(ctx, c){
    var miss = c.gates.filter(function(g){ return !g.pass; }).map(function(g){ return g.n; });
    var parts = [];
    if (miss.indexOf(5) >= 0) parts.push('close back ' + (c.dir === 'long' ? 'above ' : 'below ') + px(c.level));
    if (miss.indexOf(4) >= 0) parts.push('a wick through ' + px(c.level) + ' by ≥ $' + num(Math.max(0.5, 0.05 * ctx.atr1h)));
    if (miss.indexOf(6) >= 0) parts.push('rejection printing inside a fresh ' + c.dir + ' OB');
    if (miss.indexOf(9) >= 0) parts.push('a T1 node giving ≥ 1.5R (now ' + num(c.rr1) + 'R)');
    if (miss.indexOf(10) >= 0) parts.push('a tighter wick (R $' + num(c.risk) + ' > cap $' + num(0.6 * ctx.atr4h) + ')');
    if (miss.indexOf(7) >= 0) parts.push('a London/NY session without news lock');
    if (miss.indexOf(2) >= 0 || miss.indexOf(1) >= 0) parts.push('4H bias to resolve (' + ctx.bias.bias + ')');
    if (miss.indexOf(3) >= 0) parts.push('entry to sit on a 4H node + OB (now ' + c.grade + ')');
    return (parts.length ? parts.join(' · ') : 'nothing — gates pass') + ' on the ' + istUtc(nextCloseMs(ctx)) + ' close';
  }
  function nextRescan(nowMs){
    var lon = nextLocalHourMs(nowMs, 'Europe/London', 8), ny = nextLocalHourMs(nowMs, 'America/New_York', 8);
    var next = Math.min(isFinite(lon) ? lon : Infinity, isFinite(ny) ? ny : Infinity);
    if (!isFinite(next)) return 'unavailable';
    return (next === lon ? 'London open ' : 'NY open ') + istUtcDay(next);
  }

  function trigger(ctx, best, s6, elig){
    var out = { state: 'WAIT', reason: '', line: '', s37: null };
    var lastBar = ctx.rows1h[ctx.rows1h.length - 1];
    var nextClose = nextCloseMs(ctx);
    if (!best){
      out.state = 'WAIT';
      out.reason = 'no candidate qualifies — nothing to trigger';
      out.s37 = ctx.acceptance ? 'S37 second-chance eligible (acceptance printed) — re-run Steps 3–6 for it' : 'S37 second-chance not eligible (no acceptance)';
      return out;
    }
    var valid = s6 && (s6.result === 'VALID' || s6.result === 'VALID-HALF');
    var dist = Math.abs(lastBar.c - best.entry), distR = best.risk > 0 ? dist / best.risk : NaN;
    var sess = ctx.session;
    var expiredWhy = null;
    if (best.acceptance && best.sid !== 'S37') expiredWhy = 'acceptance — two 1H closes beyond ' + px(best.level);
    else if (best.age > MAX_SWEEP_AGE) expiredWhy = 'sweep is ' + best.age + ' bars old (> ' + MAX_SWEEP_AGE + ')';
    else if (!sess.tradeable) expiredWhy = 'session window closed (' + sess.label + ')';
    else if (best.vetoes.length) expiredWhy = 'veto active — ' + best.vetoes.join(' · ');
    else if (isFinite(distR) && distR > 1) expiredWhy = 'price ran ' + num(distR) + 'R from entry — do not chase';
    if (expiredWhy){
      out.state = 'EXPIRED'; out.reason = expiredWhy;
      out.s37 = ctx.acceptance ? 'S37 failed-sweep continuation now eligible — re-run Steps 3–6 for it' : 'S37 not eligible (no acceptance through the pool)';
      return out;
    }
    if (best.reclaimed && isFinite(distR) && distR <= 0.25 && best.age <= MAX_SWEEP_AGE && valid){
      out.state = 'TRIGGERED';
      out.reason = 'reclaim closed on the ' + istUtc((lastBar.t + HOUR) * 1000) + ' bar, price ' + num(distR) + 'R from entry, sweep ' + best.age + ' bars old, checklist ' + s6.result;
      var sz = ctx.equity > 0 ? (sizing(ctx, best).pick) : 'account size missing';
      out.line = 'You can enter at market or limit at ' + px(best.entry) + '. Stop ' + px(best.stop) + '. T1 ' + px(best.t1) + '. T2 ' + px(best.t2)
        + '. Size ' + sz + '. Time stop ' + fmtHM(sess.londonCloseMs, 'Asia/Kolkata') + ' IST.';
      return out;
    }
    out.state = 'WAIT';
    if (!best.reclaimed) out.reason = 'sweep wick ' + px(best.wick) + ' printed ' + best.age + ' bar(s) ago; need the ' + istUtc(nextClose) + ' close back ' + (best.dir === 'long' ? 'above ' : 'below ') + px(best.level);
    else if (!valid) out.reason = 'reclaim closed but checklist ' + (s6 ? s6.result : 'INVALID') + ' (' + (s6 ? s6.failing.join(', ') : '') + ') — need those gates on the ' + istUtc(nextClose) + ' close';
    else out.reason = 'price ' + num(distR) + 'R from entry ' + px(best.entry) + ' (> 0.25R) — wait for the retest; next close ' + istUtc(nextClose);
    out.ifClose = 'if the ' + istUtc(nextClose) + ' bar closes ' + (best.dir === 'long' ? 'above ' : 'below ') + px(best.level) + ' → TRIGGERED, limit ' + px(best.entry)
      + ' · if it closes ' + (best.dir === 'long' ? 'below' : 'above') + ' again → EXPIRED (acceptance), S37 check';
    return out;
  }

  function summaryLines(out, ctx, best){
    var L = [], s1 = out.steps.s1, s2 = out.steps.s2, s4 = out.steps.s4, s5 = out.steps.s5, s6 = out.steps.s6, s7 = out.steps.s7;
    L.push('STEP 1  ' + out.feed.name + ' · ' + out.feed.bars1h + '×1H' + (out.feed.derived4h ? ' (4H derived @22:00 UTC)' : '') + ' · last close ' + fmtHM(out.feed.lastCloseMs, 'UTC') + ' UTC'
      + ' · POC4H ' + px(s1.vp && s1.vp.poc) + ' | VAH ' + px(s1.vp && s1.vp.vah) + ' | VAL ' + px(s1.vp && s1.vp.val));
    L.push('        Asia ' + (s1.asia ? px(s1.asia.lo) + '–' + px(s1.asia.hi) : 'unavailable') + ' | PDH ' + px(s1.pd && s1.pd.hi) + ' PDL ' + px(s1.pd && s1.pd.lo)
      + ' | ATR4H ' + num(s1.atr4h, 0) + ' (' + s1.atrRegime + ') ATR1H ' + num(s1.atr1h, 0) + ' | ADR used ' + num(s1.adr.used, 0) + '%');
    L.push('        RSI4H ' + num(s1.rsi4h, 0) + ' | EMA ' + s1.emaSlope + ' | KER ' + num(s1.ker) + ' (' + s1.kerLabel + ') | ' + s1.session.label
      + ' | news ' + (s1.news.available ? (s1.news.next ? ('next ' + s1.news.next + ' T' + s1.news.nextTier + ' ' + fmtHM(s1.news.nextMs, 'Asia/Kolkata') + ' IST') : 'none') : 'unavailable'));
    L.push('        Eligible: ' + (s1.eligible.map(function(e){ return e.id + (e.role === 'targets' ? '(targets)' : e.role === 'context' ? '(ctx)' : ''); }).join(' ') || 'none')
      + ' | Disabled: ' + s1.disabled.slice(0, 5).map(function(d){ return d.id; }).join(' ') + (s1.disabled.length > 5 ? ' …' : ''));
    L.push('STEP 2  BIAS ' + s2.bias + ' — ' + s2.why[0] + '. RSI veto: ' + s2.rsiVeto);
    var c3 = out.steps.s3.candidates;
    L.push('STEP 3  ' + (c3.length ? c3.slice(0, 3).map(function(c){ return c.rank + '. ' + c.sid + ' ' + up(c.dir) + ' ' + c.grade + ' ' + c.gatesPass + '/12' + (isFinite(c.rr1) ? ' RR ' + num(c.rr1, 1) : '') + (c.held ? ' HELD' : ''); }).join('  ') : 'no candidates') + ' (rule-based confluence rank)');
    if (!best){
      L.push('STEP 4  NO SETUP — ' + s4.why);
      if (s4.closest && s4.closest.length) L.push('        closest: ' + s4.closest.map(function(c){ return c.sid + ' ' + up(c.dir) + ' missing ' + (c.missing.slice(0, 3).join(', ') || 'none'); }).join(' | '));
      L.push('STEP 5  n/a — NO SETUP, nothing to price');
      L.push('STEP 6  n/a — no candidate reached the checklist');
      L.push('STEP 7  ' + s7.state + ' — ' + s7.reason + ' · next re-scan ' + s4.nextRescan);
    } else {
      L.push('STEP 4  Best fit: ' + s4.why);
      L.push('STEP 5  ENTRY ' + px(s5.entry) + ' | STOP ' + px(s5.stop) + ' (R ' + num(s5.risk, 0) + ') | T1 ' + px(s5.t1) + ' RR ' + num(s5.rr1, 1) + ' | T2 ' + px(s5.t2) + ' RR ' + num(s5.rr2, 1)
        + ' | ' + s5.size.pick + ' | time stop ' + fmtHM(ctx.session.londonCloseMs, 'Asia/Kolkata') + ' IST');
      L.push('STEP 6  ' + s6.result + ' — gates ' + best.gatesPass + '/12' + (s6.failing.length ? ' (fail ' + s6.failing.join(', ') + ')' : '') + ' · sanity ' + s6.sanity.map(function(s){ return s.pass ? 'PASS' : 'FAIL'; }).join(' '));
      L.push('STEP 7  ' + s7.state + ' — ' + s7.reason);
      if (s7.line) L.push('        ' + s7.line);
      if (s7.ifClose) L.push('        ' + s7.ifClose);
      if (s7.s37) L.push('        ' + s7.s37);
    }
    L.push(out.disclaimer);
    return L.slice(0, 15);
  }

  /* ================================================================== */
  /*                              RENDER                                */
  /* ================================================================== */
  function chip(txt, cls){ return '<span class="og-chip ' + (cls || '') + '" style="display:inline-block;padding:1px 6px;margin:1px 3px 1px 0;border:1px solid var(--line,#345);border-radius:4px;font-size:11px">' + esc(txt) + '</span>'; }
  function lab(state){
    var s = String(state || '');
    return s === 'live' ? chip('live', 'ok') : s === 'proxy' ? chip('proxy', 'warn') : chip('unavailable', 'dim');
  }
  function hgGoldSevenStepHtml(r){
    try{
      if (!r) return '';
      var h = '<div class="note" data-hg-gold-seven="1" style="margin-top:10px">';
      h += '<b>GOLD 7-STEP SETUP ENGINE</b> · swing 4H context / 1H execution · ' + esc(r.nowIst);
      if (!r.ok){
        h += '<div style="margin-top:6px"><b>DATA_UNAVAILABLE</b> — ' + esc(r.why) + '</div>';
        h += '<div class="dim" style="margin-top:4px">' + esc(r.disclaimer) + '</div></div>';
        return h;
      }
      var s1 = r.steps.s1, s2 = r.steps.s2, s3 = r.steps.s3, s4 = r.steps.s4, s5 = r.steps.s5, s6 = r.steps.s6, s7 = r.steps.s7;
      function step(n, title){ return '<div style="margin-top:8px"><b>STEP ' + n + ' — ' + esc(title) + '</b></div>'; }
      function row(k, v){ return '<div class="dim"><u>' + esc(k) + '</u> ' + v + '</div>'; }

      h += step(1, 'LOAD INDICATORS AND STRATEGIES ON LIVE PRICE');
      h += row('Feed', esc(r.feed.name) + ' · ' + r.feed.bars1h + ' × 1H closed · ' + r.feed.bars4h + ' × 4H' + (r.feed.derived4h ? ' (derived from 1H @ 22:00 UTC)' : '') + ' · last closed 1H ' + esc(istUtc(r.feed.lastCloseMs)) + ' · last close ' + px(s1.lastPx)
        + (isFinite(r.feed.basisPct) ? ' · venue basis ' + num(r.feed.basisPct) + '%' : ''));
      if (s1.vp){
        h += row('VP (4H dealing range, $' + num(s1.vp.rowUsd, 1) + ' rows)', 'POC <b>' + px(s1.vp.poc) + '</b> · VAH <b>' + px(s1.vp.vah) + '</b> · VAL <b>' + px(s1.vp.val) + '</b>'
          + (s1.vp.volumeTrusted ? '' : ' · <i>volume not trusted on this feed</i>'));
        h += row('HVN zones', esc(zoneTxt(s1.vp.hvn))) + row('LVN zones', esc(zoneTxt(s1.vp.lvn)));
      } else h += row('VP', 'unavailable');
      h += row('Dealing range', s1.dealingRange ? (px(s1.dealingRange.lo) + ' → ' + px(s1.dealingRange.hi) + ' · EQ ' + px(s1.dealingRange.eq) + ' · price in <b>' + s1.dealingRange.half + '</b> half') : 'unavailable');
      h += row('Session POCs (last 3)', (s1.sessionPocs.length ? s1.sessionPocs.map(function(p){ return esc(p.day.slice(5)) + ' ' + px(p.poc); }).join(' → ') : 'unavailable') + ' · stepping <b>' + esc(s1.pocStep) + '</b>');
      h += row('Asia range', s1.asia ? (px(s1.asia.lo) + ' – ' + px(s1.asia.hi) + ' · POC ' + px(s1.asia.poc) + (s1.asia.building ? ' · still building' : '')) : 'unavailable');
      h += row('PDH / PDL', s1.pd ? (px(s1.pd.hi) + ' / ' + px(s1.pd.lo)) : 'unavailable') + row('PWH / PWL', s1.pw ? (px(s1.pw.hi) + ' / ' + px(s1.pw.lo)) : 'unavailable');
      h += row('Equal highs / lows (≤ $1.50, 1H)', (s1.eq.highs.length ? 'EQH ' + s1.eq.highs.map(function(e){ return px(e.level); }).join(', ') : 'no EQH') + ' · ' + (s1.eq.lows.length ? 'EQL ' + s1.eq.lows.map(function(e){ return px(e.level); }).join(', ') : 'no EQL'));
      h += row('Fresh 1H OB', (s1.obs.bull ? 'bull ' + px(s1.obs.bull.lo) + '–' + px(s1.obs.bull.hi) + ' (age ' + s1.obs.bull.age + ')' : 'no fresh bull OB') + ' · ' + (s1.obs.bear ? 'bear ' + px(s1.obs.bear.lo) + '–' + px(s1.obs.bear.hi) + ' (age ' + s1.obs.bear.age + ')' : 'no fresh bear OB'));
      h += row('ATR', '4H ' + num(s1.atr4h) + ' · 1H ' + num(s1.atr1h) + ' · regime ATR14/50 ' + num(s1.atrRatio) + ' <b>' + esc(s1.atrRegime) + '</b> · ADR(10) ' + num(s1.adr.adr) + ' · used today <b>' + num(s1.adr.used, 0) + '%</b>');
      h += row('RSI(14) 4H', num(s1.rsi4h, 1) + ' · 1H ' + (s1.struct1h.higherLows ? 'higher lows' : s1.struct1h.lowerHighs ? 'lower highs' : 'no clean sequence'));
      h += row('EMA 20/50 slope (4H)', esc(s1.emaSlope) + ' · KER(20) ' + num(s1.ker) + ' <b>' + esc(s1.kerLabel) + '</b>');
      h += row('Session', '<b>' + esc(s1.session.label) + '</b> · London ' + (s1.session.londonDst ? 'BST' : 'GMT') + ' · NY ' + (s1.session.nyDst ? 'EDT' : 'EST')
        + ' · next event ' + (s1.news.available ? (s1.news.next ? esc(s1.news.next) + ' (Tier ' + s1.news.nextTier + ') ' + esc(istUtc(s1.news.nextMs)) + ' · lockout ' + esc(s1.news.window) : 'none listed') : 'calendar unavailable') + (s1.news.lock ? ' · <b>LOCKOUT ACTIVE</b>' : ''));
      h += row('Macro / positioning', 'DXY ' + esc(s1.dxy.dir) + (isFinite(s1.dxy.chgPct) ? ' ' + num(s1.dxy.chgPct) + '%' : '') + lab(s1.dxy.state)
        + ' funding ' + (isFinite(s1.funding.value) ? num(s1.funding.value, 4) + '%' : '') + lab(s1.funding.state)
        + ' OI 24h ' + (isFinite(s1.oi.chgPct) ? num(s1.oi.chgPct, 1) + '%' : '') + lab(s1.oi.state)
        + ' GVZ ' + (isFinite(s1.gvz.value) ? num(s1.gvz.value, 1) : '') + lab(s1.gvz.state)
        + ' COT MM ' + (isFinite(s1.cot.value) ? num(s1.cot.value, 0) + 'pct' : '') + lab(s1.cot.state)
        + ' Shanghai ' + (isFinite(s1.shanghai.value) ? (s1.shanghai.value >= 0 ? '+' : '−') : '') + lab(s1.shanghai.state));
      h += row('ELIGIBLE', s1.eligible.map(function(e){ return chip(e.id + ' ' + e.name + (e.role === 'lead' ? '' : ' · ' + e.role), 'ok'); }).join('') || 'none');
      h += row('DISABLED', s1.disabled.map(function(d){ return chip(d.id + ' — ' + d.why, 'dim'); }).join(''));

      h += step(2, 'DIRECTION OF GOLD');
      h += '<div><b>' + esc(s2.bias) + (s2.transition ? ' (TRANSITION → WAIT)' : '') + '</b></div>';
      h += '<div class="dim">' + s2.why.map(esc).join(' · ') + '</div>';
      h += row('RSI exhaustion', esc(s2.rsiVeto));

      h += step(3, 'CANDIDATE SETUPS FROM ALL STRATEGIES (' + s3.rankName + ')');
      if (!s3.candidates.length) h += '<div class="dim">no eligible strategy has a sweep on the last ' + (MAX_SWEEP_AGE + 1) + ' closed 1H bars (' + s3.poolsScanned + ' pools scanned)</div>';
      var ci;
      for (ci = 0; ci < s3.candidates.length; ci++){
        var c = s3.candidates[ci];
        h += '<div style="margin-top:4px;padding-left:6px;border-left:2px solid var(--line,#345)"><b>' + c.rank + '. ' + esc(c.sid) + ' ' + esc(up(c.dir)) + '</b> · ' + esc(c.name)
          + ' · location <b>' + esc(c.grade) + '</b> · gates <b>' + c.gatesPass + '/' + CORE_GATES + '</b> · RR T1 ' + num(c.rr1) + ' · families ' + c.families.agree + '/' + c.families.total
          + (c.held ? ' · <b>HELD (against tape)</b>' : '') + (c.vetoes.length ? ' · veto: ' + esc(c.vetoes.join(' · ')) : '') + '</div>';
        h += '<div class="dim" style="padding-left:8px">pass ' + esc(c.gates.filter(function(g){ return g.pass; }).map(function(g){ return 'G' + g.n; }).join(' ')) + ' · fail ' + esc(c.gates.filter(function(g){ return !g.pass; }).map(function(g){ return 'G' + g.n + ' ' + g.name; }).join(' · ') || 'none') + '</div>';
      }

      h += step(4, 'SELECT THE BEST FIT');
      if (s4.noSetup){
        h += '<div><b>NO SETUP</b> — ' + esc(s4.why) + '</div>';
        if (s4.closest && s4.closest.length){
          for (ci = 0; ci < s4.closest.length; ci++){
            var k = s4.closest[ci];
            h += '<div class="dim" style="margin-top:3px">' + esc(k.sid + ' ' + up(k.dir) + ' ' + k.kind) + ' · ' + k.gatesPass + '/' + CORE_GATES + ' · missing ' + esc(k.missing.join(', ') || 'none') + (k.vetoes.length ? ' · ' + esc(k.vetoes.join(' · ')) : '') + '<br>needs: ' + esc(k.nextClose) + '</div>';
          }
        }
        h += row('Next re-scan', esc(s4.nextRescan));
      } else {
        h += '<div><b>' + esc(s4.best.sid + ' ' + up(s4.best.dir)) + '</b> — ' + esc(s4.why) + '</div>';
        if (s4.disqualified.length) h += '<div class="dim">disqualified: ' + s4.disqualified.map(function(d){ return esc(d.sid + ' ' + up(d.dir) + ' — ' + d.why); }).join(' · ') + '</div>';
      }

      if (s5){
        h += step(5, 'THE SETUP: ENTRY, STOP, TARGETS');
        h += '<div><b>' + esc(up(s5.dir)) + ' XAUUSD · ENTRY ' + px(s5.entry) + '</b> — ' + esc(s5.entryCondition) + '</div>';
        h += row('STOP', px(s5.stop) + ' · R $' + num(s5.risk) + ' · ' + esc(s5.stopWhy));
        h += row('T1', px(s5.t1) + ' (' + esc(s5.t1Label) + ') · RR ' + num(s5.rr1) + ' → <b>' + esc(s5.sizeBand) + '</b>');
        h += row('T2', px(s5.t2) + ' (' + esc(s5.t2Label) + ') · RR ' + num(s5.rr2));
        h += row('Management', esc(s5.management)) + row('Time stop', esc(s5.timeStop)) + row('Invalidation', esc(s5.invalidation));
        h += row('Size (1% risk)', esc(s5.size.pick) + (isFinite(s5.size.oz) ? ' · ' + num(s5.size.oz, 2) + ' oz · risk $' + num(s5.size.riskUsd, 0) : '') + (isFinite(s5.size.leverage) ? ' · leverage ≈ ' + num(s5.size.leverage, 1) + '× (output, not input)' : '') + ' · liquidation clearance unavailable (perp margin not read) · ' + esc(s5.size.per10k));
        h += row('Venue', s5.venue ? (esc(s5.venue.venue) + ' (basis ' + num(s5.venue.basisPct) + '%): ENTRY ' + px(s5.venue.entry) + ' · STOP ' + px(s5.venue.stop) + ' · T1 ' + px(s5.venue.t1) + ' · T2 ' + px(s5.venue.t2)) : 'same as analysis feed (no basis conversion needed)');
      } else {
        h += step(5, 'THE SETUP: ENTRY, STOP, TARGETS');
        h += '<div class="dim">NO SETUP — nothing to price. See STEP 4 for what the next 1H close must do.</div>';
      }

      if (!s6){
        h += step(6, 'CONFIRM AND VALIDATE');
        h += '<div class="dim">n/a — no candidate reached the checklist.</div>';
      }
      if (s6){
        h += step(6, 'CONFIRM AND VALIDATE — ' + s6.result);
        h += '<table style="width:100%;font-size:11px;border-collapse:collapse"><tr><th align="left">gate</th><th align="left">check</th><th align="left">result</th><th align="left">note</th></tr>';
        for (ci = 0; ci < s6.rows.length; ci++){
          var g = s6.rows[ci];
          h += '<tr><td>' + esc(g.gate) + '</td><td>' + esc(g.name) + '</td><td><b>' + esc(g.result) + '</b></td><td class="dim">' + esc(g.note) + '</td></tr>';
        }
        h += '</table>';
        h += '<div class="dim" style="margin-top:3px">sanity: ' + s6.sanity.map(function(s){ return '(' + s.id + ') ' + esc(s.name) + ' <b>' + (s.pass ? 'PASS' : 'FAIL') + '</b>' + (s.note ? ' — ' + esc(s.note) : ''); }).join(' · ') + '</div>';
      }

      h += step(7, 'HAS IT TRIGGERED?');
      h += '<div><b style="font-size:14px">' + esc(s7.state) + '</b> — ' + esc(s7.reason) + '</div>';
      if (s7.line) h += '<div style="margin-top:3px"><b>' + esc(s7.line) + '</b></div>';
      if (s7.ifClose) h += '<div class="dim">' + esc(s7.ifClose) + '</div>';
      if (s7.s37) h += '<div class="dim">' + esc(s7.s37) + '</div>';

      h += '<pre class="dim" style="margin-top:8px;white-space:pre-wrap;font-size:11px">' + esc(r.summary.join('\n')) + '</pre>';
      h += '</div>';
      return h;
    }catch(e){ return ''; }
  }

  /** Plain text (phone / Telegram) — the summary block. */
  function hgGoldSevenStepText(r){
    if (!r) return '';
    return (r.summary || []).join('\n');
  }

  /* ---------------- 1H loader shared by the three desks ---------------- */
  function hgGoldSevenStepLoad1h(count){
    count = count || 400;
    var xau = gfn('getXAUCandles'), ggc = gfn('getGoldCandles'), xm = gfn('getXmGoldCandles'), bk = gfn('binanceKlines');
    function srcLabel(){
      try{ var S = W.S; if (S && S.goldSrcByTf && S.goldSrcByTf['1h']) return S.goldSrcByTf['1h']; }catch(e){}
      return null;
    }
    var p = Promise.resolve({ rows: [], source: null });
    if (xau) p = p.then(function(r){ if (r.rows.length) return r; return Promise.resolve(xau('1h', count, { preferDeltaXaut: true })).then(function(rows){ return { rows: rows || [], source: srcLabel() || 'delta-xaut' }; }).catch(function(){ return r; }); });
    if (xm) p = p.then(function(r){ if (r.rows.length) return r; return Promise.resolve(xm('1h', count)).then(function(x){ return x && x.rows && x.rows.length ? { rows: x.rows, source: x.source || 'xm-xauusd' } : r; }).catch(function(){ return r; }); });
    if (ggc) p = p.then(function(r){ if (r.rows.length) return r; return Promise.resolve(ggc('1h', count)).then(function(x){ return x && x.rows && x.rows.length ? { rows: x.rows, source: x.source || 'gold' } : r; }).catch(function(){ return r; }); });
    if (bk) p = p.then(function(r){ if (r.rows.length) return r; return Promise.resolve(bk('PAXGUSDT', '1h', count)).then(function(rows){ return rows && rows.length ? { rows: rows, source: 'binance-paxg' } : r; }).catch(function(){ return r; }); });
    return p.then(function(r){
      var basis = NaN;
      try{ if (W.S && isFinite(fin(W.S.goldBasisPct))) basis = fin(W.S.goldBasisPct); }catch(e){}
      return { rows: r.rows || [], source: r.source, basisPct: basis };
    });
  }

  /** Convenience for the desks: build inputs, run, return HTML. Never throws. */
  function hgGoldSevenStepPanel(inp){
    try{ return hgGoldSevenStepHtml(hgGoldSevenStep(inp)); }catch(e){ return ''; }
  }

  W.hgGoldSevenStep = hgGoldSevenStep;
  W.hgGoldSevenStepHtml = hgGoldSevenStepHtml;
  W.hgGoldSevenStepText = hgGoldSevenStepText;
  W.hgGoldSevenStepPanel = hgGoldSevenStepPanel;
  W.hgGoldSevenStepLoad1h = hgGoldSevenStepLoad1h;
  W.hgGoldSevenStepClosedRows = closedRows;
  W.hgGoldSevenStepDerive4h = derive4h;
  W.hgGoldSevenStepSession = goldSession;
  W.hgGoldSevenStepIst = istUtc;
  /* Shared evidence helpers for sibling gold desks (OMNIGOLD 1 matrix). Pure,
     closed-bar, "unavailable"-honest — one implementation, one set of tests. */
  W.HG_GOLD7 = {
    normRows: normRows, closedRows: closedRows, derive4h: derive4h,
    emaSeries: emaSeries, rsi14: rsi14, atrN: atrN, ker20: ker20, pivots: pivots, closes: closes,
    tzHour: tzHour, tzOffsetHours: tzOffsetHours, fmtHM: fmtHM, fmtDay: fmtDay, istUtc: istUtc, istUtcDay: istUtcDay,
    nextLocalHourMs: nextLocalHourMs, todayLocalHourMs: todayLocalHourMs, goldSession: goldSession,
    isTier1: isTier1, newsRead: newsRead,
    volProfile: volProfile, zones: zones, zoneTxt: zoneTxt, dealingRange: dealingRange,
    dayKey: dayKey, sessionPocs: sessionPocs, pocStep: pocStep, asiaRange: asiaRange, priorDay: priorDay, priorWeek: priorWeek,
    equalExtremes: equalExtremes, freshObs: freshObs, adr10: adr10, structure1h: structure1h,
    pools: pools, sweepRead: sweepRead, sweepOb: sweepOb, gradeRank: gradeRank, locationGrade: locationGrade, lvnBetween: lvnBetween, targets: targets,
    dxyRead: dxyRead, fundingRead: fundingRead, oiRead: oiRead, scalarRead: scalarRead,
    px: px, num: num, esc: esc, isNum: isNum, up: up,
    ROW_USD: ROW_USD, EQ_TOL_USD: EQ_TOL_USD, STOP_BUF_MIN_USD: STOP_BUF_MIN_USD, MAX_SWEEP_AGE: MAX_SWEEP_AGE
  };
})(typeof window !== 'undefined' ? window : globalThis);
