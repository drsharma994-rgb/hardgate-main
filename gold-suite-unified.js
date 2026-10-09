/**
 * HARDGATE gold suite. Twelve core strategies, four desks, no shared rule.
 * A missing series stays unread. A quiet bar returns nothing.
 * This file does not replace a tab.
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
    return { id: id, name: name, dir: dir, entry: +entry.toFixed(2), stop: +stop.toFixed(2), target: +target.toFixed(2), why: why };
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
      if (n >= 3 && hi - lo >= 3){
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
      if (orb){
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
      if (lonN >= 3 && lonHi - lonLo >= 3 && span4 >= 1){
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
    return out;
  }

  function omniHits(raw, silverRaw, dxyRaw){
    var rows = rowsOf(raw), silver = rowsOf(silverRaw), dxy = rowsOf(dxyRaw);
    var out = [];
    if (rows.length < 8) return out;
    var last = rows[rows.length - 1], back = rows[rows.length - 3];
    var a = atr(rows, 14);
    if (!(a > 0) || !back) return out;
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
      out.push({ mean: mean, up2: mean + 2 * dev, dn2: mean - 2 * dev, dev: dev });
    }
    return out;
  }
  function pineHits(raw){
    var rows = rowsOf(raw), out = [];
    if (rows.length < 20) return out;
    var last = rows[rows.length - 1], a = atr(rows, 14);
    if (!(a > 0)) return out;
    var bands = sessionBands(rows);
    var band = bands.length ? bands[bands.length - 1] : null;
    if (band && band.dev >= 1 && bands.length >= 4){
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
    return out;
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
    return out;
  }

  function forDesk(desk, raw, extra){
    extra = extra || {};
    if (desk === 'goldscalp') return scalpHits(raw, extra.day || raw);
    if (desk === 'omnigold') return omniHits(raw, extra.silver, extra.dxy);
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
