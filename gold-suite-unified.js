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
        if (span > 0 && last.l <= lo - 1 && last.c >= lo + 0.5 && last.c > last.o && (last.c - last.l) / span >= 0.55){
          var L = hit('GS-1', 'London Judas Asian Sweep', 'long', last.c, Math.min(last.l, prev.l) - Math.max(a * 0.4, 2.8), 'Asia low was swept by at least $1 and the bar closed back inside with a rejection wick.');
          if (L) out.push(L);
        } else if (span > 0 && last.h >= hi + 1 && last.c <= hi - 0.5 && last.c < last.o && (last.h - last.c) / span >= 0.55){
          var S = hit('GS-1', 'London Judas Asian Sweep', 'short', last.c, Math.max(last.h, prev.h) + Math.max(a * 0.4, 2.8), 'Asia high was swept by at least $1 and the bar closed back inside with a rejection wick.');
          if (S) out.push(S);
        }
      }
    }
    if (hour >= 14 && hour < 16 && today){
      var ibH = -Infinity, ibL = Infinity, ibN = 0;
      for (i = 0; i < day.length - 1; i++){
        if (dayOf(day[i]) !== today) continue;
        hv = hourOf(day[i]);
        if (!isFinite(hv) || hv < 13.5 || hv >= 14) continue;
        if (day[i].h > ibH) ibH = day[i].h;
        if (day[i].l < ibL) ibL = day[i].l;
        ibN++;
      }
      if (ibN >= 1 && ibH - ibL >= 3){
        if (last.l <= ibL - 1 && last.c >= ibL && last.c > last.o){
          var ibLhit = hit('GS-2', 'NY Cash Initial Balance', 'long', last.c, last.l - Math.max(a * 0.35, 2.5), 'The NY opening half-hour low was swept by at least $1 and the bar closed back inside.');
          if (ibLhit) out.push(ibLhit);
        } else if (last.h >= ibH + 1 && last.c <= ibH && last.c < last.o){
          var ibShit = hit('GS-2', 'NY Cash Initial Balance', 'short', last.c, last.h + Math.max(a * 0.35, 2.5), 'The NY opening half-hour high was swept by at least $1 and the bar closed back inside.');
          if (ibShit) out.push(ibShit);
        }
      }
    }
    if ((hour >= 7 && hour < 10) || (hour >= 12.5 && hour < 16)){
      var bodyPrevTop = Math.max(prev.o, prev.c), bodyPrevBot = Math.min(prev.o, prev.c);
      var bodyTop = Math.max(last.o, last.c), bodyBot = Math.min(last.o, last.c);
      if (last.l > bodyPrevTop && last.l - bodyPrevTop >= 0.8 && last.c > last.o){
        var viL = hit('GS-3', 'Volume Imbalance Sniping', 'long', last.c, bodyPrevTop - Math.max(a * 0.3, 2), 'A bullish body gap of at least $0.80 is still open at the close.');
        if (viL) out.push(viL);
      } else if (bodyPrevBot - last.h >= 0.8 && last.c < last.o){
        var viS = hit('GS-3', 'Volume Imbalance Sniping', 'short', last.c, bodyPrevBot + Math.max(a * 0.3, 2), 'A bearish body gap of at least $0.80 is still open at the close.');
        if (viS) out.push(viS);
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
    var r = pearson(rows, dxy, 30);
    if (r != null && r > 0.15 && last.c > last.o && Math.abs(last.c - last.o) >= a * 0.4 && dxy.length >= 5 && dxy[dxy.length - 1].c > dxy[dxy.length - 5].c){
      var fts = hit('OG-2', 'Flight-to-Safety Trend', 'long', last.c, last.l - Math.max(a * 0.45, 3.2), 'Gold and the dollar rose together. The 30-bar correlation is above +0.15.');
      if (fts) out.push(fts);
    }
    var bull = null, bear = null, i, gap;
    for (i = rows.length - 18; i < rows.length - 1; i++){
      if (i < 2) continue;
      if (rows[i].l > rows[i - 2].h){
        gap = rows[i].l - rows[i - 2].h;
        if (gap >= a * 0.1) bull = { lo: rows[i - 2].h, hi: rows[i].l };
      }
      if (rows[i].h < rows[i - 2].l){
        gap = rows[i - 2].l - rows[i].h;
        if (gap >= a * 0.1) bear = { lo: rows[i].h, hi: rows[i - 2].l };
      }
    }
    if (bull && bear){
      var zLo = Math.max(bull.lo, bear.lo), zHi = Math.min(bull.hi, bear.hi);
      if (zHi - zLo >= 1 && last.l <= zHi && last.h >= zLo){
        var prev = rows[rows.length - 2];
        if (last.c > zHi && last.c > last.o && prev.c <= zHi){
          var bprL = hit('OG-3', 'Balanced Price Range', 'long', last.c, zLo - Math.max(a * 0.2, 1.5), 'Price tagged the overlap of a bull gap and a bear gap and closed back above it.');
          if (bprL) out.push(bprL);
        } else if (last.c < zLo && last.c < last.o && prev.c >= zLo){
          var bprS = hit('OG-3', 'Balanced Price Range', 'short', last.c, zHi + Math.max(a * 0.2, 1.5), 'Price tagged the overlap of a bull gap and a bear gap and closed back under it.');
          if (bprS) out.push(bprS);
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
    var highs = [], lows = [], k;
    for (k = 2; k < rows.length - 1; k++){
      if (rows[k].h >= rows[k - 1].h && rows[k].h >= rows[k + 1].h) highs.push({ p: rows[k].h, i: k });
      if (rows[k].l <= rows[k - 1].l && rows[k].l <= rows[k + 1].l) lows.push({ p: rows[k].l, i: k });
    }
    var eqH = NaN, eqL = NaN, p, q;
    for (p = 0; p < highs.length; p++){
      for (q = p + 1; q < highs.length; q++){
        if (Math.abs(highs[q].i - highs[p].i) >= 4 && Math.abs(highs[p].p - highs[q].p) <= 1.5) eqH = Math.max(highs[p].p, highs[q].p);
      }
    }
    for (p = 0; p < lows.length; p++){
      for (q = p + 1; q < lows.length; q++){
        if (Math.abs(lows[q].i - lows[p].i) >= 4 && Math.abs(lows[p].p - lows[q].p) <= 1.5) eqL = Math.min(lows[p].p, lows[q].p);
      }
    }
    if (isFinite(eqH) && last.h > eqH && last.c >= eqH + 0.5 && last.c > last.o){
      var voidL = hit('PG-3', 'Resting Liquidity Void', 'long', last.c, last.l - Math.max(a * 0.3, 2), 'Equal highs were run and the bar closed beyond them.');
      if (voidL) out.push(voidL);
    }
    if (isFinite(eqL) && last.l < eqL && last.c <= eqL - 0.5 && last.c < last.o){
      var voidS = hit('PG-3', 'Resting Liquidity Void', 'short', last.c, last.h + Math.max(a * 0.3, 2), 'Equal lows were run and the bar closed beyond them.');
      if (voidS) out.push(voidS);
    }
    return out;
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
    var squared = isFinite(ratio) && ratio >= 0.8 && ratio <= 1.2;
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
    if (squared){
      var hi16 = -Infinity, lo16 = Infinity, bi;
      for (bi = rows.length - 16; bi < rows.length; bi++){
        if (rows[bi].h > hi16) hi16 = rows[bi].h;
        if (rows[bi].l < lo16) lo16 = rows[bi].l;
      }
      var mid16 = (hi16 + lo16) / 2;
      var offHigh = hi16 - last.c >= last.c - lo16;
      if (offHigh && last.c < last.o && last.c < mid16){
        var gg2s = hit('GG-2', 'Time-Price Square', 'short', last.c, last.h + Math.max(a * 0.3, 2), 'Sixteen bars match the dollar distance, and this bar turned down from the high.');
        if (gg2s) out.push(gg2s);
      } else if (!offHigh && last.c > last.o && last.c > mid16){
        var gg2l = hit('GG-2', 'Time-Price Square', 'long', last.c, last.l - Math.max(a * 0.3, 2), 'Sixteen bars match the dollar distance, and this bar turned up from the low.');
        if (gg2l) out.push(gg2l);
      }
    }
    var drives = [], k;
    for (k = 2; k < rows.length - 1; k++){
      if (rows[k].h >= rows[k - 1].h && rows[k].h > rows[k + 1].h) drives.push(rows[k].h - rows[k].l);
    }
    if (drives.length >= 3){
      var a1 = drives[drives.length - 3], a2 = drives[drives.length - 2], a3 = drives[drives.length - 1];
      if (a1 > a2 && a2 > a3 && last.c < last.o){
        var gg3 = hit('GG-3', 'Three-Drive Harmonic', 'short', last.c, last.h + Math.max(a * 0.35, 2.5), 'Three pushes up, each smaller than the one before, and this bar closed down.');
        if (gg3) out.push(gg3);
      }
    }
    var lows = [];
    for (k = 2; k < rows.length - 1; k++){
      if (rows[k].l <= rows[k - 1].l && rows[k].l < rows[k + 1].l) lows.push(rows[k].h - rows[k].l);
    }
    if (lows.length >= 3){
      var b1 = lows[lows.length - 3], b2 = lows[lows.length - 2], b3 = lows[lows.length - 1];
      if (b1 > b2 && b2 > b3 && last.c > last.o){
        var gg3L = hit('GG-3', 'Three-Drive Harmonic', 'long', last.c, last.l - Math.max(a * 0.35, 2.5), 'Three pushes down, each smaller than the one before, and this bar closed up.');
        if (gg3L) out.push(gg3L);
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
