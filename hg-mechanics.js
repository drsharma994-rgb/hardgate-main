/* =========================================================================
hg-mechanics.js — the instrument-agnostic mechanics, in ONE place.

These sixteen detectors were written and tested inside omnigold.js, but not
one of them knows anything about gold: every threshold is expressed in ATR or
in percent, so they read a BTC 4h chart exactly as well as an XAUUSD 1h one.
Adding them to OMNIROUTE by copying would have doubled the maintenance
surface for no benefit and guaranteed the two copies drift — the app already
carries ~300 lines of that kind of duplication between the gold desks, and it
is not a debt worth taking on deliberately.

So they live here, both desks call them, and a fix lands once.

CONTRACT. Every detector is PURE: rows in, {kind, dir, level, why} or null
out. No fetching, no DOM, no localStorage, no state between calls. Degenerate
input returns null rather than throwing — a detector that throws takes the
whole scan down with it.

hgMechResample is the odd one out: it returns bars, not a hit. It builds a
higher timeframe from bars already in hand, which is how the htf-confirm gate
avoids a second fetch that could disagree with the first.

Load order: BEFORE omniroute.js and omnigold.js. Both feature-check every
function, so a missing file degrades to "that mechanic did not fire" rather
than a broken tab — but it means the desks quietly lose mechanics, so the
absence is worth noticing.
========================================================================= */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

function W(){ return (typeof window !== 'undefined') ? window : null; }
function gfn(name){
  var w = W();
  return (w && typeof w[name] === 'function') ? w[name] : null;
}
function num(v){ var n = +v; return isFinite(n) ? n : NaN; }
/* null/undefined/'' -> NaN. isFinite(null) is TRUE in JS and +null is 0, so
   the natural guard reads a missing value as a confident zero. */
function fin(v){
  if (v === null || v === undefined || v === '') return NaN;
  var n = +v;
  return isFinite(n) ? n : NaN;
}

  function hgMechResample(rows, factor){
    if (!rows || !rows.length || !(factor > 1)) return null;
    var out = [], i, j, o, h, l, c, v, t, bar;
    var start = rows.length % factor;      /* drop the ragged oldest partial */
    for (i = start; i + factor <= rows.length; i += factor){
      o = num(rows[i].o); t = num(rows[i].t);
      h = -Infinity; l = Infinity; v = 0; c = NaN;
      for (j = i; j < i + factor; j++){
        bar = rows[j];
        var bh = num(bar.h), bl = num(bar.l), bc = num(bar.c), bv = num(bar.v);
        if (isFinite(bh) && bh > h) h = bh;
        if (isFinite(bl) && bl < l) l = bl;
        if (isFinite(bc)) c = bc;
        if (isFinite(bv)) v += bv;
      }
      if (!isFinite(o) || !isFinite(c) || !isFinite(h) || !isFinite(l) || !isFinite(t)) continue;
      out.push({ t: t, o: o, h: h, l: l, c: c, v: v });
    }
    return out.length ? out : null;
  }

  function hgMechVwapRevert(rows){
    if (!rows || rows.length < 30) return null;
    var n = rows.length - 1;
    var c = num(rows[n].c);
    if (!isFinite(c)) return null;
    var vw = NaN;
    var vwFn = gfn('vwapAt');
    if (vwFn){ try { vw = num(vwFn(rows, n)); } catch (e) { vw = NaN; } }
    if (!isFinite(vw)){
      var pv = 0, vol = 0, i;
      for (i = Math.max(0, rows.length - 24); i <= n; i++){
        var tp = (num(rows[i].h) + num(rows[i].l) + num(rows[i].c)) / 3;
        var v = num(rows[i].v);
        if (!isFinite(tp)) continue;
        if (!isFinite(v) || v <= 0) v = 1;
        pv += tp * v; vol += v;
      }
      if (!(vol > 0)) return null;
      vw = pv / vol;
    }
    if (!isFinite(vw) || !(vw > 0)) return null;
    var sum = 0, cnt = 0, j;
    for (j = Math.max(0, rows.length - 24); j <= n; j++){
      var cc = num(rows[j].c);
      if (!isFinite(cc)) continue;
      sum += (cc - vw) * (cc - vw); cnt++;
    }
    if (cnt < 10) return null;
    var sd = Math.sqrt(sum / cnt);
    if (!(sd > 0)) return null;
    var z = (c - vw) / sd;
    if (z >= 2){
      return { kind:'VWAP-REVERT', dir:'short', level: vw,
               why:'price ' + z.toFixed(1) + ' SD above session VWAP ' + vw.toFixed(2) };
    }
    if (z <= -2){
      return { kind:'VWAP-REVERT', dir:'long', level: vw,
               why:'price ' + Math.abs(z).toFixed(1) + ' SD below session VWAP ' + vw.toFixed(2) };
    }
    return null;
  }

  function hgMechNr7Break(rows){
    if (!rows || rows.length < 9) return null;
    var n = rows.length - 1, i, rngs = [];
    for (i = n - 7; i <= n - 1; i++){
      if (i < 0) return null;
      var h = num(rows[i].h), l = num(rows[i].l);
      if (!isFinite(h) || !isFinite(l)) return null;
      rngs.push({ i: i, r: h - l });
    }
    var narrow = rngs[rngs.length - 1];
    for (i = 0; i < rngs.length; i++) if (rngs[i].r < narrow.r) return null;
    var nh = num(rows[narrow.i].h), nl = num(rows[narrow.i].l);
    var c = num(rows[n].c), lh = num(rows[n].h), ll = num(rows[n].l);
    if (!isFinite(c) || !isFinite(nh) || !isFinite(nl) || !isFinite(lh) || !isFinite(ll)) return null;
    if (!((lh - ll) > narrow.r * 1.5)) return null;    /* needs real expansion */
    if (c > nh) return { kind:'NR7-BREAK', dir:'long', level: nh,
                         why:'expansion above the narrowest bar in seven (' + nh.toFixed(2) + ')' };
    if (c < nl) return { kind:'NR7-BREAK', dir:'short', level: nl,
                         why:'expansion below the narrowest bar in seven (' + nl.toFixed(2) + ')' };
    return null;
  }

  function hgMechTrendReclaim(rows){
    if (!rows || rows.length < 60) return null;
    var c = [], i;
    for (i = 0; i < rows.length; i++){ var v = num(rows[i].c); if (isFinite(v)) c.push(v); }
    if (c.length < 60) return null;
    var e21 = emaOf(c, 21), e50 = emaOf(c, 50);
    var pe21 = emaOf(c.slice(0, c.length - 1), 21);
    if (!isFinite(e21) || !isFinite(e50) || !isFinite(pe21)) return null;
    var last = c[c.length - 1], prev = c[c.length - 2];
    if (!isFinite(last) || !isFinite(prev)) return null;
    if (e21 > e50 && prev < pe21 && last > e21){
      return { kind:'TREND-RECLAIM', dir:'long', level: e21,
               why:'pullback through the 21-EMA reclaimed inside an up stack' };
    }
    if (e21 < e50 && prev > pe21 && last < e21){
      return { kind:'TREND-RECLAIM', dir:'short', level: e21,
               why:'pullback through the 21-EMA rejected inside a down stack' };
    }
    return null;
  }

  function hgMechFvgFill(rows){
    if (!rows || rows.length < 12) return null;
    var n = rows.length - 1;
    var c = num(rows[n].c);
    if (!isFinite(c)) return null;
    /* Look back over recent bars for the freshest unfilled gap. */
    var i, aH, aL, bH, bL, gapLo, gapHi;
    /* From n-1, not n-2: the freshest tradeable gap is the one completed on
       the previous bar and re-entered by this one, and starting a bar later
       skipped exactly that case. */
    for (i = n - 1; i >= Math.max(2, n - 30); i--){
      aH = num(rows[i - 2].h); aL = num(rows[i - 2].l);
      bH = num(rows[i].h);     bL = num(rows[i].l);
      if (!isFinite(aH) || !isFinite(aL) || !isFinite(bH) || !isFinite(bL)) continue;
      if (bL > aH){                                  /* bullish gap: aH .. bL */
        gapLo = aH; gapHi = bL;
        if (c >= gapLo && c <= gapHi){
          return { kind:'FVG-FILL', dir:'long', level: gapLo,
                   why:'price back inside an unfilled bullish imbalance ' + gapLo.toFixed(2) + '–' + gapHi.toFixed(2) };
        }
        if (c < gapLo) return null;                  /* gap already run through */
      } else if (bH < aL){                           /* bearish gap: bH .. aL */
        gapLo = bH; gapHi = aL;
        if (c >= gapLo && c <= gapHi){
          return { kind:'FVG-FILL', dir:'short', level: gapHi,
                   why:'price back inside an unfilled bearish imbalance ' + gapLo.toFixed(2) + '–' + gapHi.toFixed(2) };
        }
        if (c > gapHi) return null;
      }
    }
    return null;
  }

  function hgMechBosRetest(rows){
    if (!rows || rows.length < 60) return null;
    var f = gfn('hgStructure');
    if (!f) return null;
    var st;
    try { st = f(rows, {}); } catch (e) { return null; }
    var bos = st && st.lastBOS;
    if (!bos) return null;
    var lvl = num(bos.level), bi = num(bos.i);
    if (!isFinite(lvl) || !isFinite(bi)) return null;
    var n = rows.length - 1;
    var age = n - bi;
    if (!(age >= 1 && age <= 20)) return null;       /* a stale break is not a retest */
    var c = num(rows[n].c), l = num(rows[n].l), h = num(rows[n].h);
    var a = atrOf(rows, 14);
    if (!isFinite(c) || !isFinite(l) || !isFinite(h) || !isFinite(a) || !(a > 0)) return null;
    var near = a * 0.5;
    if (bos.dir === 'up' && l <= lvl + near && c > lvl){
      return { kind:'BOS-RETEST', dir:'long', level: lvl,
               why:'retest of the broken structure high ' + lvl.toFixed(2) + ' holding as support' };
    }
    if (bos.dir === 'down' && h >= lvl - near && c < lvl){
      return { kind:'BOS-RETEST', dir:'short', level: lvl,
               why:'retest of the broken structure low ' + lvl.toFixed(2) + ' capping as resistance' };
    }
    return null;
  }

  function hgMechPoolSweep(rows){
    if (!rows || rows.length < 30) return null;
    var f = gfn('findLiquidityPools');
    if (!f) return null;
    var pools;
    try { pools = f(rows); } catch (e) { return null; }
    if (!pools) return null;
    var n = rows.length - 1;
    var h = num(rows[n].h), l = num(rows[n].l), c = num(rows[n].c);
    if (!isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    var rng = h - l;
    if (!(rng > 0)) return null;
    var bs = pools.buySide, ss = pools.sellSide;
    var bl = bs ? num(bs.level) : NaN, sl = ss ? num(ss.level) : NaN;
    if (isFinite(bl) && h > bl && c < bl && (h - bl) >= rng * 0.2){
      return { kind:'EQH-SWEEP', dir:'short', level: bl,
               why:'swept ' + (num(bs.count) || 0) + ' equal highs at ' + bl.toFixed(2) + ' and closed back below' };
    }
    if (isFinite(sl) && l < sl && c > sl && (sl - l) >= rng * 0.2){
      return { kind:'EQL-SWEEP', dir:'long', level: sl,
               why:'swept ' + (num(ss.count) || 0) + ' equal lows at ' + sl.toFixed(2) + ' and reclaimed' };
    }
    return null;
  }

  function hgMechSqueezeFire(rows){
    if (!rows || rows.length < 60) return null;
    var f = gfn('ttmSqueeze');
    if (!f) return null;
    var s;
    try { s = f(rows); } catch (e) { return null; }
    if (!s || !s.fired || !s.fired.length || !s.momentum) return null;
    var n = s.fired.length - 1;
    if (s.fired[n] !== true) return null;
    var mom = num(s.momentum[n]);
    if (!isFinite(mom) || mom === 0) return null;
    var c = num(rows[rows.length - 1].c);
    if (!isFinite(c)) return null;
    return { kind:'SQUEEZE-FIRE', dir: mom > 0 ? 'long' : 'short', level: c,
             why:'volatility squeeze released with momentum ' + (mom > 0 ? 'up' : 'down') };
  }

  function hgMechRsiDiverge(rows){
    if (!rows || rows.length < 80) return null;
    var rsiFn = gfn('rsi'), pivFn = gfn('findPivots');
    if (!rsiFn || !pivFn) return null;
    var closes = closesOf(rows);
    if (closes.length < 80) return null;
    var r, piv;
    try { r = rsiFn(closes, 14); piv = pivFn(closes, 5); } catch (e) { return null; }
    if (!r || !r.length || !piv || piv.length < 2) return null;
    var n = closes.length - 1;
    function lastTwo(type){
      var out = [], i;
      for (i = piv.length - 1; i >= 0 && out.length < 2; i--) if (piv[i].type === type) out.push(piv[i]);
      return out;
    }
    var hi = lastTwo('high'), lo = lastTwo('low');
    /* the newer pivot has to be recent enough to still be tradeable */
    function fresh(p){ return p && isFinite(num(p.i)) && (n - num(p.i)) <= 8; }
    if (hi.length === 2 && fresh(hi[0])){
      var pNew = num(hi[0].v), pOld = num(hi[1].v);
      var rNew = num(r[num(hi[0].i)]), rOld = num(r[num(hi[1].i)]);
      if (isFinite(pNew) && isFinite(pOld) && isFinite(rNew) && isFinite(rOld)
          && pNew > pOld && rNew < rOld){
        return { kind:'RSI-DIVERGE', dir:'short', level: pNew,
                 why:'higher price high into a lower RSI high (' + rOld.toFixed(0) + ' -> ' + rNew.toFixed(0) + ')' };
      }
    }
    if (lo.length === 2 && fresh(lo[0])){
      var qNew = num(lo[0].v), qOld = num(lo[1].v);
      var sNew = num(r[num(lo[0].i)]), sOld = num(r[num(lo[1].i)]);
      if (isFinite(qNew) && isFinite(qOld) && isFinite(sNew) && isFinite(sOld)
          && qNew < qOld && sNew > sOld){
        return { kind:'RSI-DIVERGE', dir:'long', level: qNew,
                 why:'lower price low into a higher RSI low (' + sOld.toFixed(0) + ' -> ' + sNew.toFixed(0) + ')' };
      }
    }
    return null;
  }

  function hgMechAvwapReclaim(rows){
    if (!rows || rows.length < 80) return null;
    var af = gfn('hgAVWAP'), pf = gfn('findPivots');
    if (!af || !pf) return null;
    var closes = closesOf(rows);
    if (closes.length < 80) return null;
    var piv;
    try { piv = pf(closes, 5); } catch (e) { return null; }
    if (!piv || !piv.length) return null;
    var n = rows.length - 1;
    var anchor = null, i;
    for (i = piv.length - 1; i >= 0; i--){
      var pi = num(piv[i].i);
      if (isFinite(pi) && (n - pi) >= 15 && (n - pi) <= 120){ anchor = piv[i]; break; }
    }
    if (!anchor) return null;
    var av;
    try { av = af(rows, num(anchor.i)); } catch (e) { return null; }
    if (!av) return null;
    var v = num(av.value);
    if (!isFinite(v) || !(v > 0)) return null;
    var c = num(rows[n].c), pc = num(rows[n - 1].c);
    if (!isFinite(c) || !isFinite(pc)) return null;
    /* A reclaim is a cross, not a state: it has to have happened on this bar. */
    if (pc <= v && c > v && anchor.type === 'low'){
      return { kind:'AVWAP-RECLAIM', dir:'long', level: v,
               why:'reclaimed the VWAP anchored to the swing low at ' + v.toFixed(2) };
    }
    if (pc >= v && c < v && anchor.type === 'high'){
      return { kind:'AVWAP-RECLAIM', dir:'short', level: v,
               why:'lost the VWAP anchored to the swing high at ' + v.toFixed(2) };
    }
    return null;
  }

  function hgMechCusumShift(rows){
    if (!rows || rows.length < 60) return null;
    var f = gfn('cusumLast');
    if (!f) return null;
    var closes = closesOf(rows);
    if (closes.length < 60) return null;
    /* k is the CUSUM decision interval in units of ONE BAR's return sigma.
       At the library default k=1 the threshold is crossed almost every bar:
       swept over 300 tapes it reported a fresh shift on 299 of them, which is
       not a signal, it is a description of noise — and as a TREND-family
       mechanic it would have swamped the consensus vote on every scan.
       k=12 puts it at 11%, which is what a structural mean shift should be. */
    var s;
    try { s = f(closes, 12); } catch (e) { return null; }
    if (!s || (s.dir !== 'long' && s.dir !== 'short')) return null;
    var age = num(s.barsAgo);
    if (!isFinite(age) || age > 3) return null;        /* only a fresh shift is tradeable */
    var c = num(closes[closes.length - 1]);
    if (!isFinite(c)) return null;
    return { kind:'CUSUM-SHIFT', dir: s.dir, level: c,
             why:'CUSUM marks a structural ' + (s.dir === 'long' ? 'upward' : 'downward')
                 + ' mean shift ' + age + ' bar' + (age === 1 ? '' : 's') + ' ago' };
  }

  function hgMechVolExpansion(rows){
    if (!rows || rows.length < 120) return null;
    var f = gfn('hgVolFromCloses');
    if (!f) return null;
    var closes = closesOf(rows);
    if (closes.length < 120) return null;
    var vp;
    try { vp = f(closes, {}); } catch (e) { return null; }
    if (!vp) return null;
    var now = num(vp.sigmaNow), lr = num(vp.sigmaLongRun);
    if (!isFinite(now) || !isFinite(lr) || !(lr > 0)) return null;
    var ratio = now / lr;
    if (!(ratio >= 1.6)) return null;
    var n = rows.length - 1;
    var c = num(rows[n].c), o = num(rows[n].o), h = num(rows[n].h), l = num(rows[n].l);
    if (!isFinite(c) || !isFinite(o) || !isFinite(h) || !isFinite(l)) return null;
    var rng = h - l;
    if (!(rng > 0) || Math.abs(c - o) < rng * 0.5) return null;   /* needs a decisive bar */
    return { kind:'VOL-EXPANSION', dir: c > o ? 'long' : 'short', level: c,
             why:'volatility ' + ratio.toFixed(1) + 'x its long-run level, expanding on a decisive bar' };
  }

  function hgMechPinReject(rows){
    if (!rows || rows.length < 20) return null;
    var n = rows.length - 1;
    var o = num(rows[n].o), h = num(rows[n].h), l = num(rows[n].l), c = num(rows[n].c);
    if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
    var rng = h - l;
    if (!(rng > 0)) return null;
    var a = atrOf(rows, 14);
    if (!isFinite(a) || !(a > 0) || rng < a * 0.8) return null;    /* a meaningful bar, not noise */
    var body = Math.abs(c - o);
    var upper = h - Math.max(o, c), lower = Math.min(o, c) - l;
    if (body > rng * 0.34) return null;                            /* a pin is mostly wick */
    if (lower >= rng * 0.6 && upper <= rng * 0.2){
      return { kind:'PIN-REJECT', dir:'long', level: l,
               why:'pin bar rejecting ' + l.toFixed(2) + ' — ' + ((lower / rng) * 100).toFixed(0) + '% lower wick' };
    }
    if (upper >= rng * 0.6 && lower <= rng * 0.2){
      return { kind:'PIN-REJECT', dir:'short', level: h,
               why:'pin bar rejecting ' + h.toFixed(2) + ' — ' + ((upper / rng) * 100).toFixed(0) + '% upper wick' };
    }
    return null;
  }

  function hgMechEngulfLevel(rows){
    if (!rows || rows.length < 20) return null;
    var n = rows.length - 1;
    var o = num(rows[n].o), c = num(rows[n].c), h = num(rows[n].h), l = num(rows[n].l);
    var po = num(rows[n-1].o), pc = num(rows[n-1].c), ph = num(rows[n-1].h), pl = num(rows[n-1].l);
    if (!isFinite(o) || !isFinite(c) || !isFinite(po) || !isFinite(pc)) return null;
    if (!isFinite(h) || !isFinite(l) || !isFinite(ph) || !isFinite(pl)) return null;
    var a = atrOf(rows, 14);
    if (!isFinite(a) || !(a > 0)) return null;
    var body = Math.abs(c - o), pBody = Math.abs(pc - po);
    if (!(body > pBody) || body < a * 0.6) return null;
    if (c > o && pc < po && c > Math.max(po, pc) && l <= pl){
      return { kind:'ENGULF-LEVEL', dir:'long', level: pl,
               why:'bullish engulfing that took the prior low ' + pl.toFixed(2) + ' first' };
    }
    if (c < o && pc > po && c < Math.min(po, pc) && h >= ph){
      return { kind:'ENGULF-LEVEL', dir:'short', level: ph,
               why:'bearish engulfing that took the prior high ' + ph.toFixed(2) + ' first' };
    }
    return null;
  }

  function hgMechPocRevert(rows){
    if (!rows || rows.length < 120) return null;
    var f = gfn('volumeProfile');
    if (!f) return null;
    var prof;
    try { prof = f(rows, Math.max(0, rows.length - 200), rows.length - 1); } catch (e) { return null; }
    if (!prof) return null;
    var poc = num(prof.poc), vah = num(prof.vah), val = num(prof.val);
    var c = num(rows[rows.length - 1].c);
    var a = atrOf(rows, 14);
    if (!isFinite(poc) || !isFinite(vah) || !isFinite(val) || !isFinite(c)) return null;
    if (!isFinite(a) || !(a > 0) || !(vah > val)) return null;
    var away = (c - poc) / a;
    if (Math.abs(away) < 2.5) return null;             /* must be genuinely stretched */
    if (c > vah && away >= 2.5){
      return { kind:'POC-REVERT', dir:'short', level: poc,
               why:'price ' + away.toFixed(1) + ' ATR above the point of control ' + poc.toFixed(2) + ' and outside value' };
    }
    if (c < val && away <= -2.5){
      return { kind:'POC-REVERT', dir:'long', level: poc,
               why:'price ' + Math.abs(away).toFixed(1) + ' ATR below the point of control ' + poc.toFixed(2) + ' and outside value' };
    }
    return null;
  }

  function hgMechThreeBar(rows){
    if (!rows || rows.length < 20) return null;
    var n = rows.length - 1;
    var l0 = num(rows[n-2].l), l1 = num(rows[n-1].l), l2 = num(rows[n].l);
    var h0 = num(rows[n-2].h), h1 = num(rows[n-1].h), h2 = num(rows[n].h);
    var c2 = num(rows[n].c), c0 = num(rows[n-2].c);
    if (!isFinite(l0) || !isFinite(l1) || !isFinite(l2)) return null;
    if (!isFinite(h0) || !isFinite(h1) || !isFinite(h2)) return null;
    if (!isFinite(c2) || !isFinite(c0)) return null;
    var a = atrOf(rows, 14);
    if (!isFinite(a) || !(a > 0)) return null;
    if (l1 < l0 && l1 < l2 && c2 > c0 && (c2 - l1) >= a * 0.8){
      return { kind:'THREE-BAR', dir:'long', level: l1,
               why:'three-bar reversal off ' + l1.toFixed(2) + ', confirmed by the close' };
    }
    if (h1 > h0 && h1 > h2 && c2 < c0 && (h1 - c2) >= a * 0.8){
      return { kind:'THREE-BAR', dir:'short', level: h1,
               why:'three-bar reversal off ' + h1.toFixed(2) + ', confirmed by the close' };
    }
    return null;
  }

  function emaOf(vals, n){
    if (!vals || vals.length < n || n <= 0) return NaN;
    var k = 2 / (n + 1), e = vals[0], i;
    for (i = 1; i < vals.length; i++) e = vals[i] * k + e * (1 - k);
    return e;
  }

  function closesOf(rows){
    var out = [], i, c;
    if (!rows || !rows.length) return out;
    /* A null ENTRY, not just a null array: a feed that drops a bar leaves a
       hole in the middle, and reaching through it threw from inside whatever
       gate happened to call this first. Skip the hole, keep the series. */
    for (i = 0; i < rows.length; i++){
      if (!rows[i]) continue;
      c = num(rows[i].c);
      if (isFinite(c)) out.push(c);
    }
    return out;
  }

  function atrOf(rows, n){
    if (!rows || rows.length < n + 1) return NaN;
    var sum = 0, cnt = 0, i, h, l, pc, tr;
    for (i = rows.length - n; i < rows.length; i++){
      h = num(rows[i].h); l = num(rows[i].l); pc = num(rows[i - 1].c);
      if (!isFinite(h) || !isFinite(l) || !isFinite(pc)) continue;
      tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      sum += tr; cnt++;
    }
    return cnt ? sum / cnt : NaN;
  }

  function meanVol(rows, n){
    if (!rows || !rows.length) return NaN;
    var s = 0, c = 0, i, v;
    for (i = Math.max(0, rows.length - n); i < rows.length; i++){
      v = num(rows[i].v); if (isFinite(v)) { s += v; c++; }
    }
    return c ? s / c : NaN;
  }

/* ---- exports ---------------------------------------------------------- */
G.hgMechResample     = hgMechResample;
G.hgMechVwapRevert   = hgMechVwapRevert;
G.hgMechNr7Break     = hgMechNr7Break;
G.hgMechTrendReclaim = hgMechTrendReclaim;
G.hgMechFvgFill      = hgMechFvgFill;
G.hgMechBosRetest    = hgMechBosRetest;
G.hgMechPoolSweep    = hgMechPoolSweep;
G.hgMechSqueezeFire  = hgMechSqueezeFire;
G.hgMechRsiDiverge   = hgMechRsiDiverge;
G.hgMechAvwapReclaim = hgMechAvwapReclaim;
G.hgMechCusumShift   = hgMechCusumShift;
G.hgMechVolExpansion = hgMechVolExpansion;
G.hgMechPinReject    = hgMechPinReject;
G.hgMechEngulfLevel  = hgMechEngulfLevel;
G.hgMechPocRevert    = hgMechPocRevert;
G.hgMechThreeBar     = hgMechThreeBar;

/* Every kind this module can emit, and the consensus family each belongs to.
   Exported so a desk cannot register a mechanic without also giving it a
   family — an unmapped kind falls into OTHER, where it silently merges with
   every other unmapped kind and mis-counts the vote. */
G.HG_MECH_KINDS = ['VWAP-REVERT','NR7-BREAK','TREND-RECLAIM','FVG-FILL','BOS-RETEST',
                   'EQH-SWEEP','EQL-SWEEP','SQUEEZE-FIRE','RSI-DIVERGE','AVWAP-RECLAIM',
                   'CUSUM-SHIFT','VOL-EXPANSION','PIN-REJECT','ENGULF-LEVEL',
                   'POC-REVERT','THREE-BAR'];
G.HG_MECH_FAMILY = {
  'EQH-SWEEP':'SWEEP', 'EQL-SWEEP':'SWEEP', 'PIN-REJECT':'SWEEP',
  'ENGULF-LEVEL':'SWEEP', 'THREE-BAR':'SWEEP',
  'NR7-BREAK':'TREND', 'TREND-RECLAIM':'TREND', 'BOS-RETEST':'TREND',
  'SQUEEZE-FIRE':'TREND', 'CUSUM-SHIFT':'TREND', 'VOL-EXPANSION':'TREND',
  'VWAP-REVERT':'REVERSION', 'RSI-DIVERGE':'REVERSION',
  /* AVWAP-RECLAIM IS NOT A FADE, AND CALLING IT ONE BROKE A LIVE CARD.
     The detector fires LONG when price crosses UP through the VWAP anchored
     to a swing LOW, and SHORT when it crosses DOWN through one anchored to a
     swing HIGH. Both trade WITH the cross: an up-move resuming after a
     pullback, or a down-move resuming. That is continuation.
     Classed REVERSION, it was exempted from every trend gate, and a live
     gold TICKET came out reading "above the upper Keltner band - the stretch
     a reversion mechanic is fading" on a LONG that was buying that stretch,
     with stoch RSI 100 and the 20-bar range broken above. Six gates
     describing a long as a fade of the move it was joining.
     Every other REVERSION member genuinely fades: VWAP-REVERT, POC-REVERT,
     ADR-FADE, VALUE, ABSORB and RSI-DIVERGE all trade against a stretch.
     This one was alone in being wrong. */
  'AVWAP-RECLAIM':'TREND', 'POC-REVERT':'REVERSION',
  'FVG-FILL':'IMBALANCE'
};

/* Run every detector over one series. Each is wrapped: one throwing detector
   must not cost the other fifteen, nor take the scan down with it. */
G.hgMechRunAll = function hgMechRunAll(rows){
  var out = [], i, d;
  var fns = [hgMechVwapRevert, hgMechNr7Break, hgMechTrendReclaim, hgMechFvgFill,
             hgMechBosRetest, hgMechPoolSweep, hgMechSqueezeFire, hgMechRsiDiverge,
             hgMechAvwapReclaim, hgMechCusumShift, hgMechVolExpansion, hgMechPinReject,
             hgMechEngulfLevel, hgMechPocRevert, hgMechThreeBar];
  for (i = 0; i < fns.length; i++){
    try { d = fns[i](rows); } catch (e) { d = null; }
    if (d && d.kind && (d.dir === 'long' || d.dir === 'short') && isFinite(fin(d.level))) out.push(d);
  }
  return out;
};

})();
