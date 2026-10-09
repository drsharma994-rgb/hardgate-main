/**
 * HARDGATE gold suite. Sixteen core strategies, four desks, no shared rule.
 * A missing series stays unread. A quiet bar returns nothing.
 * This file does not replace a tab.
 *
 * THE PARTICIPATION LAYER (hg-v1276). Every hit carries `pace` — the
 * confirming bar's volume over the MEDIAN of the last PACE_WIN readable
 * bars on the same tape (null when the feed is volume-deaf: a number is
 * never fabricated, and nothing is withheld from a feed that cannot
 * speak — the hg-v700 rule). The four session-raid detections — GS-1
 * Judas, GS-2 cash-open ORB, GS-4 London-NY overlap, GS-5 dual 
 * boundary, PG-1 band pierce —
 * require a DEFENDED print (GS-5 dual boundary joined the set with hg-v1277): a readable pace under PACE_DEAD is a sweep
 * nobody came to, and the hit is withheld, the same honesty as a quiet
 * bar. Level and shape reads (Gann, value area, SMT, ratio bands) carry
 * the number without a bar: their premises are not participation.
 * The why sentence states the participation whenever it is readable.
 */
(function (root) {
  'use strict';
  function num(v){ return (typeof v === 'number' && isFinite(v)) ? v : NaN; }
  function bar(k){
    if (!k) return null;
    var o = num(k.o != null ? k.o : k.open);
    var h = num(k.h != null ? k.h : k.high);
    var l = num(k.l != null ? k.l : k.low);
    var c = num(k.c != null ? k.c : k.close);
    var t = num(k.t != null ? k.t : (k.time != null ? k.time : k.ts));
    var v = num(k.v != null ? k.v : k.volume);
    if (!(c > 0) || !isFinite(h) || !isFinite(l) || !isFinite(o) || !(h >= l)) return null;
    if (isFinite(t) && t < 1e12) t *= 1000;
    return { o: o, h: h, l: l, c: c, t: t, v: (isFinite(v) && v > 0) ? v : 0 };
  }
  function rowsOf(raw){
    var src = raw;
    if (root.hgGoldBars){ try { src = root.hgGoldBars(raw) || raw; } catch (e) {} }
    var out = [], i, b;
    if (!src || !src.length) return out;
    for (i = 0; i < src.length; i++){
      b = bar(src[i]);
      if (!b) return [];
      out.push(b);
    }
    return out;
  }
  function hourOf(b){
    if (!b || !isFinite(b.t)) return NaN;
    var d = new Date(b.t);
    return d.getUTCHours() + d.getUTCMinutes() / 60;
  }
  function dayOf(b){
    if (!b || !isFinite(b.t)) return null;
    return new Date(b.t).toISOString().slice(0, 10);
  }
  function atr(rows, n){
    if (!rows || rows.length < n + 1) return NaN;
    var sum = 0, i, b, prev, tr;
    for (i = rows.length - n; i < rows.length; i++){
      b = rows[i]; prev = rows[i - 1];
      tr = Math.max(b.h - b.l, Math.abs(b.h - prev.c), Math.abs(b.l - prev.c));
      sum += tr;
    }
    var v = sum / n;
    return v > 0 ? v : NaN;
  }
  function hit(id, name, dir, entry, stop, why){
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    if (dir === 'long' && !(stop < entry)) return null;
    if (dir === 'short' && !(stop > entry)) return null;
    var target = dir === 'long' ? entry + risk * 2.5 : entry - risk * 2.5;
    /* hg-v1276: the participation the confirming bar printed, stated on the
       hit when readable — null when the feed cannot speak (never a guess). */
    var pcsay = (__pace != null) ? ' \u00b7 participation ' + __pace.toFixed(2) + '\u00d7 the 20-bar median' : '';
    return { id: id, name: name, dir: dir, entry: +entry.toFixed(2), stop: +stop.toFixed(2), target: +target.toFixed(2), why: why + pcsay, pace: (__pace != null) ? __pace : null };
  }
  function pearson(gold, other, n){
    if (!gold || !other || gold.length < n || other.length < n) return null;
    var g = gold.slice(-n), d = other.slice(-n), i, mg = 0, md = 0;
    for (i = 0; i < n; i++){ if (!(g[i].c > 0) || !(d[i].c > 0)) return null; mg += g[i].c; md += d[i].c; }
    mg /= n; md /= n;
    var nume = 0, dg = 0, dd = 0, x, y;
    for (i = 0; i < n; i++){
      x = g[i].c - mg; y = d[i].c - md;
      nume += x * y; dg += x * x; dd += y * y;
    }
    if (!(dg > 0) || !(dd > 0)) return null;
    return nume / Math.sqrt(dg * dd);
  }

  /* hg-v1276: THE PARTICIPATION LAYER — median volume of the last PACE_WIN
     readable bars; pace = the confirming bar's volume over that median.
     Readable means: at least PACE_MIN_READ positive volumes in the window
     and a positive print on the confirming bar itself. Anything less ->
     null, and null never withholds and never fabricates. */
  var PACE_WIN = 20, PACE_MIN_READ = 10, PACE_DEAD = 0.5;
  var __pace = null;
  function paceOf(rows){
    if (!rows || rows.length < PACE_MIN_READ) return null;
    var vols = [], i, b;
    for (i = rows.length - 1; i >= 0 && vols.length < PACE_WIN; i--){
      b = rows[i];
      if (b && b.v > 0) vols.push(b.v);
    }
    if (vols.length < PACE_MIN_READ) return null;
    var last = rows[rows.length - 1];
    if (!last || !(last.v > 0)) return null;
    vols.sort(function(x, y){ return x - y; });
    var mid = vols.length % 2 ? vols[(vols.length - 1) / 2]
            : (vols[vols.length / 2 - 1] + vols[vols.length / 2]) / 2;
    if (!(mid > 0)) return null;
    return Math.round(last.v / mid * 100) / 100;
  }
  function paceDead(pc){ return pc != null && pc < PACE_DEAD; }

  function scalpHits(raw, dayRaw){
    var rows = rowsOf(raw);
    var day = rowsOf(dayRaw || raw);
    var out = [];
    if (rows.length < 20) return out;
    var last = rows[rows.length - 1], prev = rows[rows.length - 2];
    var hour = hourOf(last);
    if (!isFinite(hour)) return out;
    var a = atr(rows, 14);
    if (!(a > 0)) return out;
    __pace = paceOf(rows);
    var today = dayOf(last), i, hv, hi = -Infinity, lo = Infinity, n = 0;
    if (hour >= 7 && hour < 10 && today){
      for (i = 0; i < day.length - 1; i++){
        if (dayOf(day[i]) !== today) continue;
        hv = hourOf(day[i]);
        if (!isFinite(hv) || hv >= 7) continue;
        if (day[i].h > hi) hi = day[i].h;
        if (day[i].l < lo) lo = day[i].l;
        n++;
      }
      /* hg-v1276: a raid sweep must be a DEFENDED print — a readable
         participation under PACE_DEAD is a sweep nobody came to, and the
         hit is withheld (a volume-deaf feed fails open above). */
      if (n >= 3 && hi - lo >= 3 && !paceDead(__pace)){
        var span = last.h - last.l;
        var depthL = lo - Math.min(last.l, prev.l);
        var depthH = Math.max(last.h, prev.h) - hi;
        if (span > 0 && depthL >= 1.5 && depthL <= 5.5 && last.c > lo && last.c > last.o && (last.c - last.l) / span >= 0.55){
          var L = hit('GS-1', 'London Judas Asian Sweep', 'long', last.c, Math.min(last.l, prev.l) - Math.max(a * 0.4, 2.8), 'Asia low was swept by ' + depthL.toFixed(2) + ' dollars, inside the 1.50 to 5.50 pocket, and the bar closed back inside.');
          if (L) out.push(L);
        } else if (span > 0 && depthH >= 1.5 && depthH <= 5.5 && last.c < hi && last.c < last.o && (last.h - last.c) / span >= 0.55){
          var S = hit('GS-1', 'London Judas Asian Sweep', 'short', last.c, Math.max(last.h, prev.h) + Math.max(a * 0.4, 2.8), 'Asia high was swept by ' + depthH.toFixed(2) + ' dollars, inside the 1.50 to 5.50 pocket, and the bar closed back inside.');
          if (S) out.push(S);
        }
      }
    }
    if (hour >= 13.75 && hour <= 14.25 && today){
      var orb = null;
      for (i = 0; i < day.length - 1; i++){
        if (dayOf(day[i]) !== today) continue;
        hv = hourOf(day[i]);
        if (!isFinite(hv) || hv < 13.5 || hv >= 13.75) continue;
        orb = day[i];
      }
      /* hg-v1276: the cash-open raid needs its defended print too. */
      if (orb && !paceDead(__pace)){
        if (last.l < orb.l && last.c > orb.l && last.c > last.o){
          var orbL = hit('GS-2', 'COMEX Cash Open ORB', 'long', last.c, last.l - Math.max(a * 0.35, 2.5), 'The 13:30 UTC cash-open low was swept and the bar closed back above it.');
          if (orbL) out.push(orbL);
        } else if (last.h > orb.h && last.c < orb.h && last.c < last.o){
          var orbS = hit('GS-2', 'COMEX Cash Open ORB', 'short', last.c, last.h + Math.max(a * 0.35, 2.5), 'The 13:30 UTC cash-open high was swept and the bar closed back under it.');
          if (orbS) out.push(orbS);
        }
      }
    }
    if ((hour >= 7 && hour < 10) || (hour >= 12.5 && hour < 16)){
      var gap = null, fi;
      for (fi = rows.length - 4; fi >= 2 && fi > rows.length - 16; fi--){
        if (rows[fi].l > rows[fi - 2].h && rows[fi].l - rows[fi - 2].h >= 0.8){ gap = { side: 'long', lo: rows[fi - 2].h, hi: rows[fi].l }; break; }
        if (rows[fi].h < rows[fi - 2].l && rows[fi - 2].l - rows[fi].h >= 0.8){ gap = { side: 'short', lo: rows[fi].h, hi: rows[fi - 2].l }; break; }
      }
      var span3 = last.h - last.l;
      if (gap && span3 > 0){
        if (gap.side === 'long' && last.l <= gap.hi && last.c > gap.hi && last.c > last.o && (last.c - last.l) / span3 >= 0.58){
          var fvgL = hit('GS-3', 'Micro FVG Wick', 'long', last.c, gap.lo, 'A bullish imbalance was tapped and the bar closed back out with a 58 percent wick.');
          if (fvgL) out.push(fvgL);
        } else if (gap.side === 'short' && last.h >= gap.lo && last.c < gap.lo && last.c < last.o && (last.h - last.c) / span3 >= 0.58){
          var fvgS = hit('GS-3', 'Micro FVG Wick', 'short', last.c, gap.hi, 'A bearish imbalance was tapped and the bar closed back out with a 58 percent wick.');
          if (fvgS) out.push(fvgS);
        }
      }
    }
    if (hour >= 12 && hour < 13.5 && today && !out.some(function(h){ return h.id === 'GS-1'; })){
      var lonHi = -Infinity, lonLo = Infinity, lonN = 0;
      for (i = 0; i < day.length - 1; i++){
        if (dayOf(day[i]) !== today) continue;
        hv = hourOf(day[i]);
        if (!isFinite(hv) || hv < 7 || hv >= 12) continue;
        if (day[i].h > lonHi) lonHi = day[i].h;
        if (day[i].l < lonLo) lonLo = day[i].l;
        lonN++;
      }
      var span4 = last.h - last.l;
      /* hg-v1276: the overlap sweep is a raid — defended print required. */
      if (lonN >= 3 && lonHi - lonLo >= 3 && span4 >= 1 && !paceDead(__pace)){
        var daerL = (Math.min(last.o, last.c) - last.l) / span4;
        var daerS = (last.h - Math.max(last.o, last.c)) / span4;
        if (last.l < lonLo && last.c > lonLo && last.c > last.o && daerL >= 0.65){
          var ovL = hit('GS-4', 'London-NY Overlap Sweep', 'long', last.c, last.l - Math.max(a * 0.35, 2.5), 'The London low was swept before the US cash open and a 65 percent wick closed back above it.');
          if (ovL) out.push(ovL);
        } else if (last.h > lonHi && last.c < lonHi && last.c < last.o && daerS >= 0.65){
          var ovS = hit('GS-4', 'London-NY Overlap Sweep', 'short', last.c, last.h + Math.max(a * 0.35, 2.5), 'The London high was swept before the US cash open and a 65 percent wick closed back under it.');
          if (ovS) out.push(ovS);
        }
      }
    }
    /* hg-v1277: the dual boundary is a raid too — a readable dead pace
       withholds it (same defended-print rule as GS-1/GS-2/GS-4). */
    if (hour >= 7 && hour < 10 && today && n >= 3 && hi - lo >= 3 && !paceDead(__pace)){
      var tookHigh = false, tookLow = false, bi;
      for (bi = Math.max(0, rows.length - 8); bi < rows.length - 1; bi++){
        if (rows[bi].h > hi) tookHigh = true;
        if (rows[bi].l < lo) tookLow = true;
      }
      if (tookHigh && last.l < lo && last.c > lo && last.c > last.o){
        var dbL = hit('GS-5', 'Dual Asia Boundary', 'long', last.c, last.l - Math.max(a * 0.4, 2.8), 'An earlier bar took the Asia high, and this bar took the Asia low and closed back above it.');
        if (dbL) out.push(dbL);
      } else if (tookLow && last.h > hi && last.c < hi && last.c < last.o){
        var dbS = hit('GS-5', 'Dual Asia Boundary', 'short', last.c, last.h + Math.max(a * 0.4, 2.8), 'An earlier bar took the Asia low, and this bar took the Asia high and closed back under it.');
        if (dbS) out.push(dbS);
      }
    }
    if (((hour >= 7 && hour < 10) || (hour >= 13.75 && hour < 16)) && today){
      var yday = null, di2, dd, pdH = -Infinity, pdL = Infinity, pdN = 0;
      for (di2 = day.length - 1; di2 >= 0; di2--){
        dd = dayOf(day[di2]);
        if (dd && dd !== today){ yday = dd; break; }
      }
      if (yday){
        for (di2 = 0; di2 < day.length; di2++){
          if (dayOf(day[di2]) !== yday) continue;
          if (day[di2].h > pdH) pdH = day[di2].h;
          if (day[di2].l < pdL) pdL = day[di2].l;
          pdN++;
        }
      }
      var span6 = last.h - last.l;
      if (pdN >= 3 && pdH - pdL >= 3 && span6 > 0 && !paceDead(__pace)){
        var depthPdL = pdL - last.l;
        var depthPdH = last.h - pdH;
        var sameAsiaL = n >= 3 && Math.abs(pdL - lo) <= 1;
        var sameAsiaH = n >= 3 && Math.abs(pdH - hi) <= 1;
        if (!sameAsiaL && depthPdL >= 1.5 && depthPdL <= 5.5 && last.c > pdL && last.c > last.o && (last.c - last.l) / span6 >= 0.55){
          var pdLhit = hit('GS-6', 'Prior Day Raid', 'long', last.c, Math.min(last.l, prev.l) - Math.max(a * 0.4, 2.8), 'The prior-day low was swept by 1.50 to 5.50 dollars and the bar closed back above it.');
          if (pdLhit) out.push(pdLhit);
        } else if (!sameAsiaH && depthPdH >= 1.5 && depthPdH <= 5.5 && last.c < pdH && last.c < last.o && (last.h - last.c) / span6 >= 0.55){
          var pdShit = hit('GS-6', 'Prior Day Raid', 'short', last.c, Math.max(last.h, prev.h) + Math.max(a * 0.4, 2.8), 'The prior-day high was swept by 1.50 to 5.50 dollars and the bar closed back under it.');
          if (pdShit) out.push(pdShit);
        }
      }
      var span7 = last.h - last.l;
      if (span7 > 0 && !paceDead(__pace)){
        var under = Math.floor((last.c - 0.01) / 10) * 10;
        var over = Math.ceil((last.c + 0.01) / 10) * 10;
        var depthUnder = under - last.l;
        var depthOver = last.h - over;
        var nearL = (n >= 3 && (Math.abs(under - lo) <= 1 || Math.abs(under - hi) <= 1)) || (pdN >= 3 && (Math.abs(under - pdL) <= 1 || Math.abs(under - pdH) <= 1));
        var nearH = (n >= 3 && (Math.abs(over - lo) <= 1 || Math.abs(over - hi) <= 1)) || (pdN >= 3 && (Math.abs(over - pdL) <= 1 || Math.abs(over - pdH) <= 1));
        if (!nearL && depthUnder >= 1 && depthUnder <= 4 && last.c > under && last.c > last.o && (last.c - last.l) / span7 >= 0.55){
          var rnL = hit('GS-7', 'Round Ten Raid', 'long', last.c, last.l - Math.max(a * 0.35, 2.5), 'A ten-dollar level was swept by 1 to 4 dollars and the bar closed back above it.');
          if (rnL) out.push(rnL);
        } else if (!nearH && depthOver >= 1 && depthOver <= 4 && last.c < over && last.c < last.o && (last.h - last.c) / span7 >= 0.55){
          var rnS = hit('GS-7', 'Round Ten Raid', 'short', last.c, last.h + Math.max(a * 0.35, 2.5), 'A ten-dollar level was swept by 1 to 4 dollars and the bar closed back under it.');
          if (rnS) out.push(rnS);
        }
      }
    }
    return out;
  }

  function omniHits(raw, silverRaw, dxyRaw, extra){
    var rows = rowsOf(raw), silver = rowsOf(silverRaw), dxy = rowsOf(dxyRaw);
    extra = extra || {};
    var out = [];
    if (rows.length < 8) return out;
    var last = rows[rows.length - 1], back = rows[rows.length - 3];
    var a = atr(rows, 14);
    if (!(a > 0) || !back) return out;
    __pace = paceOf(rows);
    if (silver.length >= 5 && dxy.length >= 5){
      var s0 = silver[silver.length - 1], s1 = silver[silver.length - 3];
      var d0 = dxy[dxy.length - 1], d1 = dxy[dxy.length - 3];
      if (s0 && s1 && d0 && d1){
        if (last.l < back.l && s0.l >= s1.l && !(d0.h > d1.h)){
          var smtL = hit('OG-1', 'Triple SMT Divergence', 'long', last.c, Math.min(last.l, back.l) - Math.max(a * 0.45, 3.2), 'Gold made a lower low. Silver and the dollar both refused it.');
          if (smtL) out.push(smtL);
        } else if (last.h > back.h && s0.h <= s1.h && !(d0.l < d1.l)){
          var smtS = hit('OG-1', 'Triple SMT Divergence', 'short', last.c, Math.max(last.h, back.h) + Math.max(a * 0.45, 3.2), 'Gold made a higher high. Silver and the dollar both refused it.');
          if (smtS) out.push(smtS);
        }
      }
    }
    var hour = hourOf(last);
    var preFix = isFinite(hour) && ((hour >= 10 && hour < 10.42) || (hour >= 14.5 && hour < 14.92));
    if (preFix && rows.length >= 16){
      var upDrift = last.c > last.o && rows[rows.length - 2].c > rows[rows.length - 2].o && rows[rows.length - 3].c > rows[rows.length - 3].o;
      var dnDrift = last.c < last.o && rows[rows.length - 2].c < rows[rows.length - 2].o && rows[rows.length - 3].c < rows[rows.length - 3].o;
      var winHi = -Infinity, winLo = Infinity, wi;
      for (wi = rows.length - 16; wi < rows.length - 1; wi++){
        if (rows[wi].h > winHi) winHi = rows[wi].h;
        if (rows[wi].l < winLo) winLo = rows[wi].l;
      }
      if (upDrift && last.h >= winHi){
        var fixS = hit('OG-2', 'London Fix Auction Drift', 'short', last.c, last.h + Math.max(a * 0.4, 3), 'Three rising closes ran into the high before the London fix.');
        if (fixS) out.push(fixS);
      } else if (dnDrift && last.l <= winLo){
        var fixL = hit('OG-2', 'London Fix Auction Drift', 'long', last.c, last.l - Math.max(a * 0.4, 3), 'Three falling closes ran into the low before the London fix.');
        if (fixL) out.push(fixL);
      }
    }
    var r = pearson(rows, dxy, 30);
    if (r != null && r > 0.15 && last.c > last.o && Math.abs(last.c - last.o) >= a * 0.4 && dxy.length >= 5 && dxy[dxy.length - 1].c > dxy[dxy.length - 5].c){
      var fts = hit('OG-3', 'Flight-to-Safety Decouple', 'long', last.c, last.l - Math.max(a * 0.45, 3.2), 'Gold and the dollar rose together. The 30-bar correlation is above +0.15.');
      if (fts) out.push(fts);
    }
    if (silver.length >= 20 && rows.length >= 20){
      var ratios = [], gi, si, gsr, mean = 0, variance = 0, sd, z;
      var nGsr = Math.min(20, rows.length, silver.length);
      for (gi = 0; gi < nGsr; gi++){
        si = silver[silver.length - nGsr + gi];
        gsr = rows[rows.length - nGsr + gi];
        if (!si || !(si.c > 0) || !gsr) { ratios = []; break; }
        ratios.push(gsr.c / si.c);
      }
      if (ratios.length === nGsr){
        for (gi = 0; gi < ratios.length; gi++) mean += ratios[gi];
        mean /= ratios.length;
        for (gi = 0; gi < ratios.length; gi++) variance += (ratios[gi] - mean) * (ratios[gi] - mean);
        sd = Math.sqrt(variance / ratios.length);
        z = sd > 0 ? (ratios[ratios.length - 1] - mean) / sd : NaN;
        if (z <= -1.8 && last.c > last.o){
          var gsrL = hit('OG-4', 'Gold-Silver Ratio Band', 'long', last.c, last.l - Math.max(a * 0.45, 3.2), 'The gold-silver ratio is 1.8 deviations cheap and this bar closed up.');
          if (gsrL) out.push(gsrL);
        } else if (z >= 1.8 && last.c < last.o){
          var gsrS = hit('OG-4', 'Gold-Silver Ratio Band', 'short', last.c, last.h + Math.max(a * 0.45, 3.2), 'The gold-silver ratio is 1.8 deviations rich and this bar closed down.');
          if (gsrS) out.push(gsrS);
        }
      }
    }
    var paxg = rowsOf(extra.paxg);
    if (paxg.length >= 2 && last.c > 0){
      var prem = (paxg[paxg.length - 1].c - last.c) / last.c;
      if (prem >= 0.002 && last.c > last.o && paxg[paxg.length - 1].c !== last.c){
        var pb = hit('OG-5', 'Physical Bullion Premium', 'long', last.c, last.l - Math.max(a * 0.45, 3.2), 'Tokenized bullion is at least 0.20 percent above this gold print, and this bar closed up.');
        if (pb) out.push(pb);
      }
    }
    var oil = rowsOf(extra.oil), yields = rowsOf(extra.yields);
    if (oil.length >= 6 && yields.length >= 6 && rows.length >= 6){
      var gUp = last.c > rows[rows.length - 6].c && last.c > last.o;
      var oUp = oil[oil.length - 1].c > oil[oil.length - 6].c;
      var yDn = yields[yields.length - 1].c < yields[yields.length - 6].c;
      if (gUp && oUp && yDn){
        var ssi = hit('OG-6', 'Stagflation Shock', 'long', last.c, last.l - Math.max(a * 0.45, 3.2), 'Gold and crude both rose over six bars while the yield print fell.');
        if (ssi) out.push(ssi);
      }
    } else if (yields.length >= 6 && rows.length >= 6){
      var yLead = yields[yields.length - 1].c < yields[yields.length - 6].c;
      var gLead = last.c > rows[rows.length - 6].c && last.c > last.o && Math.abs(last.c - last.o) >= a * 0.4;
      if (yLead && gLead){
        var yg = hit('OG-7', 'Yield Lead', 'long', last.c, last.l - Math.max(a * 0.45, 3.2), 'The yield print fell over six bars and this gold bar closed up with a real body.');
        if (yg) out.push(yg);
      }
    }
    if (dxy.length >= 5 && !out.some(function(h){ return h.id === 'OG-1'; })){
      var dx0 = dxy[dxy.length - 1], dx1 = dxy[dxy.length - 3];
      if (dx0 && dx1 && last.l < back.l && dx0.l >= dx1.l && last.c > last.o && Math.abs(last.c - last.o) >= a * 0.4){
        var dxL = hit('OG-8', 'Dollar Non-Confirmation', 'long', last.c, Math.min(last.l, back.l) - Math.max(a * 0.45, 3.2), 'Gold made a lower low and the dollar refused it. Silver was not required.');
        if (dxL) out.push(dxL);
      } else if (dx0 && dx1 && last.h > back.h && dx0.h <= dx1.h && last.c < last.o && Math.abs(last.c - last.o) >= a * 0.4){
        var dxS = hit('OG-8', 'Dollar Non-Confirmation', 'short', last.c, Math.max(last.h, back.h) + Math.max(a * 0.45, 3.2), 'Gold made a higher high and the dollar refused it. Silver was not required.');
        if (dxS) out.push(dxS);
      }
    }
    return out;
  }

  function sessionBands(rows){
    var cumV = 0, cumP = 0, cumD = 0, lastSess = '', out = [], i, b, hv, sess, typical, vol, mean, dev;
    for (i = 0; i < rows.length; i++){
      b = rows[i]; hv = hourOf(b);
      if (!isFinite(hv)) return [];
      sess = hv < 7 ? 'ASIA' : (hv < 12.5 ? 'LONDON' : (hv < 20 ? 'NY' : 'OFF'));
      if (sess !== lastSess){ cumV = 0; cumP = 0; cumD = 0; lastSess = sess; }
      typical = (b.h + b.l + b.c) / 3;
      vol = b.v > 0 ? b.v : 1;
      cumV += vol; cumP += typical * vol;
      if (!(cumV > 0)) return [];
      mean = cumP / cumV;
      cumD += vol * (typical - mean) * (typical - mean);
      dev = Math.sqrt(cumD / cumV);
      out.push({ mean: mean, up2: mean + 2 * dev, dn2: mean - 2 * dev, dev: dev, sess: sess });
    }
    return out;
  }
  function pineHits(raw){
    var rows = rowsOf(raw), out = [];
    if (rows.length < 20) return out;
    var last = rows[rows.length - 1], a = atr(rows, 14);
    if (!(a > 0)) return out;
    __pace = paceOf(rows);
    var bands = sessionBands(rows);
    var band = bands.length ? bands[bands.length - 1] : null;
    /* hg-v1276: the band pierce is a raid — a readable dead pace withholds
       it (the level/shape reads below carry the number without a bar). */
    if (band && band.dev >= 1 && bands.length >= 4 && !paceDead(__pace)){
      if (last.l <= band.dn2 && last.c > band.dn2 && last.c > last.o){
        var risk = last.c - (last.l - Math.max(a * 0.35, 2.5));
        var reward = band.mean - last.c;
        if (risk > 0 && reward >= risk * 2){
          var pg1 = hit('PG-1', 'Session AVWAP 2 sigma', 'long', last.c, last.l - Math.max(a * 0.35, 2.5), 'Price pierced the lower 2 sigma band and closed back above it.');
          if (pg1) out.push(pg1);
        }
      } else if (last.h >= band.up2 && last.c < band.up2 && last.c < last.o){
        var riskS = (last.h + Math.max(a * 0.35, 2.5)) - last.c;
        var rewardS = last.c - band.mean;
        if (riskS > 0 && rewardS >= riskS * 2){
          var pg1s = hit('PG-1', 'Session AVWAP 2 sigma', 'short', last.c, last.h + Math.max(a * 0.35, 2.5), 'Price pierced the upper 2 sigma band and closed back under it.');
          if (pg1s) out.push(pg1s);
        }
      }
    }
    var gap = null, i, mid, fresh, j;
    for (i = rows.length - 2; i >= 2 && i > rows.length - 25; i--){
      if (rows[i].l > rows[i - 2].h && (rows[i].l - rows[i - 2].h) >= a * 0.1){
        mid = (rows[i].l + rows[i - 2].h) / 2; fresh = true;
        for (j = i + 1; j < rows.length - 1; j++){ if (rows[j].l <= mid) fresh = false; }
        if (fresh){ gap = { side: 'long', mid: mid, far: rows[i - 2].h }; break; }
      }
      if (rows[i].h < rows[i - 2].l && (rows[i - 2].l - rows[i].h) >= a * 0.1){
        mid = (rows[i].h + rows[i - 2].l) / 2; fresh = true;
        for (j = i + 1; j < rows.length - 1; j++){ if (rows[j].h >= mid) fresh = false; }
        if (fresh){ gap = { side: 'short', mid: mid, far: rows[i - 2].l }; break; }
      }
    }
    if (gap && gap.side === 'long' && last.l <= gap.mid && last.c > gap.mid && last.c > last.o){
      var ce = hit('PG-2', 'Consequent Encroachment', 'long', last.c, gap.far, 'A fresh bullish gap was tagged at its midpoint and the bar closed back above it.');
      if (ce) out.push(ce);
    } else if (gap && gap.side === 'short' && last.h >= gap.mid && last.c < gap.mid && last.c < last.o){
      var ceS = hit('PG-2', 'Consequent Encroachment', 'short', last.c, gap.far, 'A fresh bearish gap was tagged at its midpoint and the bar closed back under it.');
      if (ceS) out.push(ceS);
    }
    var area = valueArea(rows);
    var prior = rows[rows.length - 2];
    if (area && prior){
      if (prior.c > area.vah && last.l <= area.vah && last.c > area.vah && last.c > last.o){
        var vaL = hit('PG-3', 'Value Area High Retest', 'long', last.c, area.val, 'Price held the developing value-area high and closed back above it.');
        if (vaL) out.push(vaL);
      } else if (prior.c < area.val && last.h >= area.val && last.c < area.val && last.c < last.o){
        var vaS = hit('PG-3', 'Value Area Low Retest', 'short', last.c, area.vah, 'Price held the developing value-area low and closed back under it.');
        if (vaS) out.push(vaS);
      }
    }
    var todayP = dayOf(last), dayOpen = NaN, dayBars = 0, di;
    if (todayP && band && band.dev >= 1){
      for (di = 0; di < rows.length; di++){
        if (dayOf(rows[di]) !== todayP) continue;
        if (!isFinite(dayOpen)) dayOpen = rows[di].o;
        dayBars++;
      }
      if (dayBars >= 8 && isFinite(dayOpen) && Math.abs(band.mean - dayOpen) <= 1.5){
        if (last.l <= band.mean && last.c > band.mean && last.c > last.o){
          var ribL = hit('PG-4', 'Session and Daily Open Ribbon', 'long', last.c, last.l - Math.max(a * 0.35, 2.5), 'The session average and the daily open are within 1.50 dollars, and this bar closed back above both.');
          if (ribL) out.push(ribL);
        } else if (last.h >= band.mean && last.c < band.mean && last.c < last.o){
          var ribS = hit('PG-4', 'Session and Daily Open Ribbon', 'short', last.c, last.h + Math.max(a * 0.35, 2.5), 'The session average and the daily open are within 1.50 dollars, and this bar closed back under both.');
          if (ribS) out.push(ribS);
        }
      }
    }
    var ob = shallowBlock(rows, a, last);
    if (ob) out.push(ob);
    var prevVw = priorSessionMean(bands);
    if (prevVw != null && band && Math.abs(band.mean - prevVw) >= 1 && !paceDead(__pace)){
      if (last.l <= prevVw && last.c > prevVw && last.c > last.o){
        var vwL = hit('PG-6', 'Prior Session VWAP', 'long', last.c, last.l - Math.max(a * 0.35, 2.5), 'The finished session average was tagged and the bar closed back above it.');
        if (vwL) out.push(vwL);
      } else if (last.h >= prevVw && last.c < prevVw && last.c < last.o){
        var vwS = hit('PG-6', 'Prior Session VWAP', 'short', last.c, last.h + Math.max(a * 0.35, 2.5), 'The finished session average was tagged and the bar closed back under it.');
        if (vwS) out.push(vwS);
      }
    }
    var ib = londonIbMid(rows);
    if (ib && isFinite(hourOf(last)) && hourOf(last) > 7.5 && hourOf(last) < 10){
      if (last.l <= ib && last.c > ib && last.c > last.o){
        var ibL = hit('PG-7', 'London Opening Midpoint', 'long', last.c, last.l - Math.max(a * 0.35, 2.5), 'The London opening midpoint was tagged after 07:30 UTC and the bar closed back above it.');
        if (ibL) out.push(ibL);
      } else if (last.h >= ib && last.c < ib && last.c < last.o){
        var ibS = hit('PG-7', 'London Opening Midpoint', 'short', last.c, last.h + Math.max(a * 0.35, 2.5), 'The London opening midpoint was tagged after 07:30 UTC and the bar closed back under it.');
        if (ibS) out.push(ibS);
      }
    }
    return out;
  }

  function londonIbMid(rows){
    var day = dayOf(rows[rows.length - 1]), hi = -Infinity, lo = Infinity, n = 0, i, hv;
    if (!day) return null;
    for (i = 0; i < rows.length - 1; i++){
      if (dayOf(rows[i]) !== day) continue;
      hv = hourOf(rows[i]);
      if (!isFinite(hv) || hv < 7 || hv >= 7.5) continue;
      if (rows[i].h > hi) hi = rows[i].h;
      if (rows[i].l < lo) lo = rows[i].l;
      n++;
    }
    if (n < 2 || !(hi - lo >= 2)) return null;
    return (hi + lo) / 2;
  }

  function priorSessionMean(bands){
    if (!bands || bands.length < 6 || !bands[bands.length - 1].sess) return null;
    var cur = bands[bands.length - 1].sess, i = bands.length - 2, prev, n = 0, mean;
    while (i >= 0 && bands[i].sess === cur) i--;
    if (i < 0) return null;
    prev = bands[i].sess;
    mean = bands[i].mean;
    while (i >= 0 && bands[i].sess === prev){ n++; i--; }
    return n >= 4 ? mean : null;
  }

  function shallowBlock(rows, a, last){
    var i, origin, next, body, pen, ratio, k, broken;
    for (i = rows.length - 5; i >= 2 && i > rows.length - 24; i--){
      origin = rows[i];
      next = rows[i + 1];
      if (!origin || !next) continue;
      body = origin.h - origin.l;
      if (!(body > 0)) continue;
      if (origin.c < origin.o && next.c > next.o && (next.c - origin.c) >= a * 1.4){
        broken = false;
        for (k = i + 2; k < rows.length - 1; k++){ if (rows[k].l <= origin.l) broken = true; }
        pen = origin.h - last.l;
        ratio = pen / body;
        if (!broken && ratio > 0 && ratio <= 0.382 && last.c > origin.h && last.c > last.o){
          return hit('PG-5', 'Shallow Order Block', 'long', last.c, origin.l, 'A bullish order block was touched by no more than 38.2 percent and the bar closed back above it.');
        }
      } else if (origin.c > origin.o && next.c < next.o && (origin.c - next.c) >= a * 1.4){
        broken = false;
        for (k = i + 2; k < rows.length - 1; k++){ if (rows[k].h >= origin.h) broken = true; }
        pen = last.h - origin.l;
        ratio = pen / body;
        if (!broken && ratio > 0 && ratio <= 0.382 && last.c < origin.l && last.c < last.o){
          return hit('PG-5', 'Shallow Order Block', 'short', last.c, origin.h, 'A bearish order block was touched by no more than 38.2 percent and the bar closed back under it.');
        }
      }
    }
    return null;
  }

  function valueArea(rows){
    var n = Math.min(rows.length, 48);
    var slice = rows.slice(rows.length - n);
    var lo = Infinity, hi = -Infinity, i, b;
    for (i = 0; i < slice.length; i++){
      if (slice[i].l < lo) lo = slice[i].l;
      if (slice[i].h > hi) hi = slice[i].h;
    }
    if (!(hi > lo + 2)) return null;
    var bins = 24, hist = [], w, idx, total = 0, poc = 0;
    for (b = 0; b < bins; b++) hist.push(0);
    for (i = 0; i < slice.length; i++){
      w = slice[i].v > 0 ? slice[i].v : 1;
      idx = Math.floor((slice[i].c - lo) / (hi - lo) * (bins - 1));
      if (idx < 0) idx = 0;
      if (idx >= bins) idx = bins - 1;
      hist[idx] += w;
    }
    for (b = 0; b < bins; b++){ total += hist[b]; if (hist[b] > hist[poc]) poc = b; }
    if (!(total > 0)) return null;
    var acc = hist[poc], left = poc, right = poc, lv, rv;
    while (acc < total * 0.7 && (left > 0 || right < bins - 1)){
      lv = left > 0 ? hist[left - 1] : -1;
      rv = right < bins - 1 ? hist[right + 1] : -1;
      if (rv >= lv){ right++; acc += hist[right]; }
      else { left--; acc += hist[left]; }
    }
    var binW = (hi - lo) / bins;
    var val = lo + left * binW, vah = lo + (right + 1) * binW;
    if (!(vah > val + 0.5)) return null;
    return { val: val, vah: vah };
  }

  function gannNear(price){
    if (!(price > 0)) return null;
    var rootN = Math.sqrt(price), best = Infinity, level = NaN, deg = 0, d, up, dn, i;
    var angles = [90, 180, 270, 360];
    for (i = 0; i < angles.length; i++){
      d = angles[i];
      up = Math.pow(rootN + d / 180, 2);
      dn = Math.pow(rootN - d / 180, 2);
      if (Math.abs(price - up) < best){ best = Math.abs(price - up); level = up; deg = d; }
      if (dn > 0 && Math.abs(price - dn) < best){ best = Math.abs(price - dn); level = dn; deg = d; }
    }
    return { dist: best, level: level, deg: deg };
  }
  function ganeshHits(raw, dxyRaw){
    var rows = rowsOf(raw), dxy = rowsOf(dxyRaw), out = [];
    if (rows.length < 35) return out;
    var last = rows[rows.length - 1], a = atr(rows, 14);
    if (!(a > 0)) return out;
    __pace = paceOf(rows);
    var hour = hourOf(last), today = dayOf(last);
    var kill = isFinite(hour) && ((hour >= 7.5 && hour <= 8.75) || (hour >= 14 && hour <= 15.25));
    var ib = isFinite(hour) && ((hour >= 7 && hour < 7.5) || (hour >= 13.5 && hour < 14));
    var asiaHi = -Infinity, asiaLo = Infinity, asiaN = 0, i, hv;
    if (today){
      for (i = 0; i < rows.length - 1; i++){
        if (dayOf(rows[i]) !== today) continue;
        hv = hourOf(rows[i]);
        if (!isFinite(hv) || hv >= 7) continue;
        if (rows[i].h > asiaHi) asiaHi = rows[i].h;
        if (rows[i].l < asiaLo) asiaLo = rows[i].l;
        asiaN++;
      }
    }
    var compressed = asiaN >= 3 && last.c > 0 && (asiaHi - asiaLo) / last.c <= 0.008;
    var gann = gannNear(last.c);
    var anchor = rows[rows.length - 16];
    var extreme = last.c, dollars = NaN;
    for (i = rows.length - 16; i < rows.length; i++){
      if (rows[i].h > extreme) extreme = rows[i].h;
    }
    dollars = Math.abs(last.c - extreme);
    var ratio = dollars > 0 ? 16 / dollars : NaN;
    var squared = isFinite(ratio) && ratio >= 0.88 && ratio <= 1.12;
    var swingHi = -Infinity, swingLo = Infinity;
    for (i = rows.length - 40; i < rows.length - 1; i++){
      if (i < 0) continue;
      if (rows[i].h > swingHi) swingHi = rows[i].h;
      if (rows[i].l < swingLo) swingLo = rows[i].l;
    }
    var span = swingHi - swingLo;
    var oteLong = span > 0 && last.l <= swingHi - span * 0.618 && last.l >= swingHi - span * 0.786 && last.c > last.o;
    var oteShort = span > 0 && last.h >= swingLo + span * 0.618 && last.h <= swingLo + span * 0.786 && last.c < last.o;
    var r = pearson(rows, dxy, 30);
    var dxyUp = dxy.length >= 11 && dxy[dxy.length - 1].c > dxy[dxy.length - 11].c;
    var macroLong = r != null && (r > 0.15 || !dxyUp);
    var macroShort = r != null && (r > 0.15 || dxyUp);
    var risk = Math.max(a * 0.45, 3.2);
    var dir = oteLong ? 'long' : (oteShort ? 'short' : (last.c > last.o ? 'long' : 'short'));
    var steps = [
      compressed,
      kill && !ib,
      !!(gann && gann.dist <= 1.8),
      squared,
      dir === 'long' ? oteLong : oteShort,
      r != null && (dir === 'long' ? macroLong : macroShort),
      risk * 2.6 >= 8.5
    ];
    var passed = steps.filter(Boolean).length;
    if (passed === 7){
      var gg1 = hit('GG-1', 'Sri Chakra 7-Step Cycle', dir, last.c, dir === 'long' ? last.c - risk : last.c + risk, 'All seven steps passed on this bar. Passed ' + passed + ' of 7.');
      if (gg1) out.push(gg1);
    }
    if (gann && gann.dist <= 1.2 && isFinite(gann.level)){
      if (last.h >= gann.level - 1.2 && last.c < gann.level && last.c < last.o){
        var gannS = hit('GG-2', 'Gann Square of 9', 'short', last.c, last.h + Math.max(a * 0.3, 2), 'Price tagged the ' + gann.deg + ' degree Gann level and closed back under it.');
        if (gannS) out.push(gannS);
      } else if (last.l <= gann.level + 1.2 && last.c > gann.level && last.c > last.o){
        var gannL = hit('GG-2', 'Gann Square of 9', 'long', last.c, last.l - Math.max(a * 0.3, 2), 'Price tagged the ' + gann.deg + ' degree Gann level and closed back above it.');
        if (gannL) out.push(gannL);
      }
    }
    if (squared){
      var hi16 = -Infinity, lo16 = Infinity, bi;
      for (bi = rows.length - 16; bi < rows.length; bi++){
        if (rows[bi].h > hi16) hi16 = rows[bi].h;
        if (rows[bi].l < lo16) lo16 = rows[bi].l;
      }
      var mid16 = (hi16 + lo16) / 2;
      var offHigh = hi16 - last.c >= last.c - lo16;
      if (offHigh && last.c < last.o && last.c < mid16){
        var gg3s = hit('GG-3', 'Time-Price Symmetry', 'short', last.c, last.h + Math.max(a * 0.3, 2), 'Bar count and dollar distance match within 12 percent, and this bar turned down.');
        if (gg3s) out.push(gg3s);
      } else if (!offHigh && last.c > last.o && last.c > mid16){
        var gg3l = hit('GG-3', 'Time-Price Symmetry', 'long', last.c, last.l - Math.max(a * 0.3, 2), 'Bar count and dollar distance match within 12 percent, and this bar turned up.');
        if (gg3l) out.push(gg3l);
      }
    }
    if (isFinite(hour)){
      var intoOct = (Math.floor(hour) * 60 + Math.round((hour % 1) * 60)) % 180;
      var prevG = rows[rows.length - 2];
      if ((intoOct <= 15 || intoOct >= 165) && prevG){
        if (prevG.c < prevG.o && last.c > last.o && last.c > prevG.c){
          var octL = hit('GG-4', 'Gann Wheel of 24', 'long', last.c, last.l - Math.max(a * 0.3, 2), 'This bar turned up within 15 minutes of a 3-hour Gann boundary.');
          if (octL) out.push(octL);
        } else if (prevG.c > prevG.o && last.c < last.o && last.c < prevG.c){
          var octS = hit('GG-4', 'Gann Wheel of 24', 'short', last.c, last.h + Math.max(a * 0.3, 2), 'This bar turned down within 15 minutes of a 3-hour Gann boundary.');
          if (octS) out.push(octS);
        }
      }
    }
    var sacred = gannAngles(last.c, [108, 144]);
    if (sacred && sacred.dist <= 1.2){
      if (last.h >= sacred.level - 1.2 && last.c < sacred.level && last.c < last.o){
        var sacS = hit('GG-5', 'Gann 108 and 144', 'short', last.c, last.h + Math.max(a * 0.3, 2), 'Price tagged the ' + sacred.deg + ' degree Gann angle and closed back under it.');
        if (sacS) out.push(sacS);
      } else if (last.l <= sacred.level + 1.2 && last.c > sacred.level && last.c > last.o){
        var sacL = hit('GG-5', 'Gann 108 and 144', 'long', last.c, last.l - Math.max(a * 0.3, 2), 'Price tagged the ' + sacred.deg + ' degree Gann angle and closed back above it.');
        if (sacL) out.push(sacL);
      }
    }
    if (rows.length >= 8){
      var hi8 = -Infinity, lo8 = Infinity, j8, ext8, dol8, ratio8, mid8;
      for (j8 = rows.length - 8; j8 < rows.length; j8++){
        if (rows[j8].h > hi8) hi8 = rows[j8].h;
        if (rows[j8].l < lo8) lo8 = rows[j8].l;
      }
      ext8 = (hi8 - last.c >= last.c - lo8) ? hi8 : lo8;
      dol8 = Math.abs(last.c - ext8);
      ratio8 = dol8 > 0 ? 8 / dol8 : NaN;
      mid8 = (hi8 + lo8) / 2;
      if (isFinite(ratio8) && ratio8 >= 0.88 && ratio8 <= 1.12){
        if (ext8 === hi8 && last.c < last.o && last.c < mid8){
          var sqS = hit('GG-6', 'Eight Bar Square', 'short', last.c, last.h + Math.max(a * 0.3, 2), 'Eight bars match the dollar distance within 12 percent, and this bar turned down.');
          if (sqS) out.push(sqS);
        } else if (ext8 === lo8 && last.c > last.o && last.c > mid8){
          var sqL = hit('GG-6', 'Eight Bar Square', 'long', last.c, last.l - Math.max(a * 0.3, 2), 'Eight bars match the dollar distance within 12 percent, and this bar turned up.');
          if (sqL) out.push(sqL);
        }
      }
    }
    var eqH = NaN, eqL = NaN, a1, b1;
    for (a1 = Math.max(0, rows.length - 20); a1 < rows.length - 2; a1++){
      for (b1 = a1 + 1; b1 < rows.length - 1; b1++){
        if (Math.abs(rows[a1].h - rows[b1].h) <= 0.8) eqH = Math.max(rows[a1].h, rows[b1].h);
        if (Math.abs(rows[a1].l - rows[b1].l) <= 0.8) eqL = Math.min(rows[a1].l, rows[b1].l);
      }
    }
    if (isFinite(eqH) && last.h - eqH >= 0.5 && last.h - eqH <= 3 && last.c < eqH && last.c < last.o){
      var eqS = hit('GG-7', 'Equal High Sweep', 'short', last.c, last.h + Math.max(a * 0.3, 2), 'Two highs within 0.80 dollars were swept and the bar closed back under them.');
      if (eqS) out.push(eqS);
    } else if (isFinite(eqL) && eqL - last.l >= 0.5 && eqL - last.l <= 3 && last.c > eqL && last.c > last.o){
      var eqLhit = hit('GG-7', 'Equal Low Sweep', 'long', last.c, last.l - Math.max(a * 0.3, 2), 'Two lows within 0.80 dollars were swept and the bar closed back above them.');
      if (eqLhit) out.push(eqLhit);
    }
    return out;
  }

  function gannAngles(price, angles){
    if (!(price > 0) || !angles || !angles.length) return null;
    var rootN = Math.sqrt(price), best = Infinity, level = NaN, deg = 0, i, d, up, dn;
    for (i = 0; i < angles.length; i++){
      d = angles[i];
      up = Math.pow(rootN + d / 180, 2);
      dn = Math.pow(rootN - d / 180, 2);
      if (Math.abs(price - up) < best){ best = Math.abs(price - up); level = up; deg = d; }
      if (dn > 0 && Math.abs(price - dn) < best){ best = Math.abs(price - dn); level = dn; deg = d; }
    }
    return { dist: best, level: level, deg: deg };
  }

  function forDesk(desk, raw, extra){
    extra = extra || {};
    if (desk === 'goldscalp') return scalpHits(raw, extra.day || raw);
    if (desk === 'omnigold') return omniHits(raw, extra.silver, extra.dxy, extra);
    if (desk === 'pinegold') return pineHits(raw);
    if (desk === 'ganeshgold') return ganeshHits(raw, extra.dxy);
    return [];
  }

  root.HG_GoldSuite = {
    scalpHits: scalpHits,
    omniHits: omniHits,
    pineHits: pineHits,
    ganeshHits: ganeshHits,
    forDesk: forDesk
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
