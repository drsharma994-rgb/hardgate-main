/* HARDGATE GOLD TITAN v7.0 (hg-v1177) — the additive quantitative layer.
   Adds the genuinely-new institutional mechanics on TOP of the existing
   GoldCoreEngine (v2.5: sessions, macro veto, Asian range, Judas sweep):
     - 30-bar rolling Pearson correlation (XAU vs DXY) + flight-to-safety
     - 20-day ADR exhaustion (dynamic % of spot, not a hardcoded dollar)
     - NYMO true-day open anchor
     - Gann Square of 9 harmonics
     - Time-price square symmetry (T = P)
     - Footprint absorption (wick ratio)
     - Double-sweep exhaustion tracker (DSET)
     - 0.618 / 0.705 / 0.786 OTE golden pocket
     - Consequent encroachment (CE 50%) on an FVG
     - Resting liquidity pool mapping (swing highs/lows)
     - 48-bar dealing-range percentile (premium / discount)
     - Dynamic 1% account-risk lot sizer
   Every function is pure and testable; the telemetry panel mounts itself
   into the gold tab panes with ZERO edits to the existing desks. Evidence,
   never a gate: the math is shown and recorded, and the forward ledger
   decides what pays. */
(function (root) {
  'use strict';
  function fin(v){ return typeof v === 'number' && isFinite(v); }
  function num(v){ var n = (typeof v === 'number') ? v : +v; return fin(n) ? n : NaN; }
  function closeOf(k){ return num(k && (k.close != null ? k.close : k.c)); }
  function highOf(k){ return num(k && (k.high != null ? k.high : k.h)); }
  function lowOf(k){ return num(k && (k.low != null ? k.low : k.l)); }
  function openOf(k){ return num(k && (k.open != null ? k.open : k.o)); }
  function timeOf(k){ var t = num(k && (k.time != null ? k.time : k.t)); if (fin(t) && t < 1e12) t = t * 1000; return fin(t) ? t : NaN; }

  function GoldTitanEngine(){ }

  /* 30-bar rolling Pearson correlation, XAU closes vs DXY closes. */
  GoldTitanEngine.prototype.pearsonCorrelation = function(goldKlines, dxyKlines, period){
    period = period || 30;
    if (!goldKlines || !dxyKlines || goldKlines.length < period || dxyKlines.length < period){
      return { r: null, regime: 'UNCORRELATED_NEUTRAL', flightToSafety: false };
    }
    var g = goldKlines.slice(-period).map(closeOf);
    var d = dxyKlines.slice(-period).map(closeOf);
    if (!g.every(fin) || !d.every(fin)){
      return { r: null, regime: 'UNCORRELATED_NEUTRAL', flightToSafety: false };
    }
    var mg = 0, md = 0, i;
    for (i = 0; i < period; i++){ mg += g[i]; md += d[i]; }
    mg /= period; md /= period;
    var num2 = 0, dg = 0, dd = 0;
    for (i = 0; i < period; i++){
      var dgx = g[i] - mg, ddx = d[i] - md;
      num2 += dgx * ddx; dg += dgx * dgx; dd += ddx * ddx;
    }
    var denom = Math.sqrt(dg * dd);
    var r = denom === 0 ? 0 : num2 / denom;
    r = +r.toFixed(3);
    var flightToSafety = r > 0.15;
    var regime = flightToSafety ? 'FLIGHT_TO_SAFETY_DECOUPLED' : (r > -0.20 ? 'UNCORRELATED_NEUTRAL' : 'STANDARD_INVERSE');
    return { r: r, regime: regime, flightToSafety: flightToSafety };
  };

  /* 20-day ADR exhaustion, dynamic % of spot. */
  GoldTitanEngine.prototype.adrExhaustion = function(dailyKlines, currentPrice, period){
    period = period || 20;
    if (!dailyKlines || dailyKlines.length < 5){
      return { adrDollars: null, usedDollars: null, pctUsed: null, exhausted: false, remainingDollars: null };
    }
    var lookback = dailyKlines.slice(-period);
    var sum = 0, n = 0, i;
    for (i = 0; i < lookback.length - 1; i++){
      var hi = highOf(lookback[i]), lo = lowOf(lookback[i]);
      if (fin(hi) && fin(lo)){ sum += (hi - lo); n++; }
    }
    var adr = n > 0 ? sum / n : null;
    var today = dailyKlines[dailyKlines.length - 1];
    var used = null;
    var th = highOf(today), tl = lowOf(today);
    if (fin(th) && fin(tl)) used = th - tl;
    var pctUsed = null, remaining = null;
    if (fin(adr) && adr > 0 && fin(used)){
      pctUsed = +((used / adr) * 100).toFixed(1);
      remaining = +Math.max(0, adr - used).toFixed(2);
    }
    return {
      adrDollars: fin(adr) ? +adr.toFixed(2) : null,
      usedDollars: fin(used) ? +used.toFixed(2) : null,
      pctUsed: pctUsed,
      exhausted: pctUsed != null && pctUsed >= 90.0,
      remainingDollars: remaining
    };
  };

  /* NYMO true-day open: today's 04:00 UTC bar, else 00:00, else first bar. */
  GoldTitanEngine.prototype.nymoTrueDayOpen = function(dayKlines){
    if (!dayKlines || !dayKlines.length) return null;
    var lastT = timeOf(dayKlines[dayKlines.length - 1]);
    if (!fin(lastT)) return { nymo: openOf(dayKlines[0]), time: NaN };
    var today = new Date(lastT).getUTCDate();
    var fallback00 = null;
    for (var i = 0; i < dayKlines.length; i++){
      var t = timeOf(dayKlines[i]);
      if (!fin(t)) continue;
      var d = new Date(t);
      if (d.getUTCDate() !== today) continue;
      var h = d.getUTCHours();
      if (h === 4) return { nymo: openOf(dayKlines[i]), time: t };
      if (h === 0 && !fallback00) fallback00 = { nymo: openOf(dayKlines[i]), time: t };
    }
    if (fallback00) return fallback00;
    return { nymo: openOf(dayKlines[0]), time: NaN };
  };

  /* Gann Square of 9: levels at sqrt(price) +/- degree/180, squared. */
  GoldTitanEngine.prototype.gannSquare9 = function(currentPrice){
    currentPrice = num(currentPrice);
    if (!fin(currentPrice) || currentPrice <= 0) return null;
    var root = Math.sqrt(currentPrice);
    var angles = [90, 180, 270, 360];
    var levels = [], closestDist = Infinity, closestLevel = null, closestDegree = null, i;
    for (i = 0; i < angles.length; i++){
      var deg = angles[i];
      var up = Math.pow(root + (deg / 180), 2);
      var down = Math.pow(root - (deg / 180), 2);
      levels.push({ degree: deg, harmonicUp: +up.toFixed(2), harmonicDown: +down.toFixed(2) });
      var du = Math.abs(currentPrice - up), dd = Math.abs(currentPrice - down);
      if (du < closestDist){ closestDist = du; closestLevel = up; closestDegree = deg; }
      if (dd < closestDist){ closestDist = dd; closestLevel = down; closestDegree = deg; }
    }
    return {
      levels: levels,
      closestLevel: closestLevel != null ? +closestLevel.toFixed(2) : null,
      closestDegree: closestDegree,
      distanceToGann: +closestDist.toFixed(2),
      isAtGannPivot: closestDist <= 1.20
    };
  };

  /* Time-price square symmetry: bars travelled vs dollars travelled. */
  GoldTitanEngine.prototype.timePriceSymmetry = function(klines, anchorBarIndex, anchorPrice){
    anchorPrice = num(anchorPrice);
    if (!klines || !klines.length || !fin(anchorPrice) || !fin(anchorBarIndex)){
      return { inSymmetry: false, ratio: null, distanceBars: null, distanceDollars: null };
    }
    var distanceBars = (klines.length - 1) - anchorBarIndex;
    var currentClose = closeOf(klines[klines.length - 1]);
    var distanceDollars = fin(currentClose) ? Math.abs(currentClose - anchorPrice) : null;
    if (!fin(distanceBars) || distanceBars <= 0 || !fin(distanceDollars) || distanceDollars <= 0){
      return { inSymmetry: false, ratio: null, distanceBars: fin(distanceBars) ? distanceBars : null, distanceDollars: distanceDollars != null ? +distanceDollars.toFixed(2) : null };
    }
    var ratio = +(distanceBars / distanceDollars).toFixed(2);
    return {
      inSymmetry: ratio >= 0.82 && ratio <= 1.18,
      ratio: ratio,
      distanceBars: distanceBars,
      distanceDollars: +distanceDollars.toFixed(2)
    };
  };

  /* Footprint absorption: the bullish lower wick (or bearish upper wick)
     as a fraction of the total range. */
  GoldTitanEngine.prototype.footprintAbsorption = function(candle, direction){
    var hi = highOf(candle), lo = lowOf(candle), o = openOf(candle), c = closeOf(candle);
    if (![hi, lo, o, c].every(fin)) return { absorbed: false, absorptionRatio: null };
    var range = hi - lo;
    if (range <= 0) return { absorbed: false, absorptionRatio: 0 };
    var wick = direction === 'BULL' ? (Math.min(o, c) - lo) : (hi - Math.max(o, c));
    var ratio = +(wick / range).toFixed(2);
    return { absorbed: ratio >= 0.58, absorptionRatio: ratio };
  };

  /* Double-sweep exhaustion tracker (DSET): >= 2 sweeps of a level in the
     last 8 bars = stage 2 exhausted. */
  GoldTitanEngine.prototype.doubleSweepExhaustion = function(klines, targetLevel, direction){
    targetLevel = num(targetLevel);
    if (!klines || klines.length < 8 || !fin(targetLevel)){
      return { sweepStage: 'NONE', confirmedStage2: false, sweepCount: 0 };
    }
    var recent = klines.slice(-8), count = 0, i;
    for (i = 0; i < recent.length; i++){
      if (direction === 'BULL' && fin(lowOf(recent[i])) && lowOf(recent[i]) < targetLevel) count++;
      else if (direction === 'BEAR' && fin(highOf(recent[i])) && highOf(recent[i]) > targetLevel) count++;
    }
    return {
      sweepStage: count >= 2 ? 'STAGE_2_EXHAUSTED' : (count === 1 ? 'STAGE_1_PRELIMINARY' : 'NONE'),
      confirmedStage2: count >= 2,
      sweepCount: count
    };
  };

  /* 0.618 / 0.705 / 0.786 OTE golden pocket from a swing high and low. */
  GoldTitanEngine.prototype.oteGoldenPocket = function(swingHigh, swingLow){
    swingHigh = num(swingHigh); swingLow = num(swingLow);
    if (!fin(swingHigh) || !fin(swingLow)) return null;
    var range = swingHigh - swingLow;
    if (range <= 0) return null;
    return {
      ret0618: +(swingHigh - range * 0.618).toFixed(2),
      ret0705: +(swingHigh - range * 0.705).toFixed(2),
      ret0786: +(swingHigh - range * 0.786).toFixed(2)
    };
  };

  /* Consequent encroachment: the 50% line of an FVG. */
  GoldTitanEngine.prototype.consequentEncroachment = function(fvgTop, fvgBottom){
    fvgTop = num(fvgTop); fvgBottom = num(fvgBottom);
    if (!fin(fvgTop) || !fin(fvgBottom)) return null;
    return { ce50: +((fvgTop + fvgBottom) / 2).toFixed(2), top: fvgTop, bottom: fvgBottom };
  };

  /* Resting liquidity pools: swing highs (buy-side) and lows (sell-side). */
  GoldTitanEngine.prototype.restingLiquidityPools = function(klines){
    var pools = [];
    if (!klines || klines.length < 11) return pools;
    var i, j;
    for (i = 5; i < klines.length - 5; i++){
      var hi = highOf(klines[i]), lo = lowOf(klines[i]);
      if (!fin(hi) || !fin(lo)) continue;
      var isH = true, isL = true;
      for (j = i - 5; j <= i + 5; j++){
        if (j === i) continue;
        if (highOf(klines[j]) >= hi) isH = false;
        if (lowOf(klines[j]) <= lo) isL = false;
      }
      if (isH) pools.push({ type: 'BUY_SIDE_LIQUIDITY', price: +hi.toFixed(2), time: timeOf(klines[i]) });
      if (isL) pools.push({ type: 'SELL_SIDE_LIQUIDITY', price: +lo.toFixed(2), time: timeOf(klines[i]) });
    }
    return pools.slice(-6);
  };

  /* 48-bar dealing range percentile (premium / discount). */
  GoldTitanEngine.prototype.dealingRange = function(dailyKlines, currentPrice){
    currentPrice = num(currentPrice);
    if (!dailyKlines || dailyKlines.length < 15 || !fin(currentPrice)) return { percentile: null, zone: 'EQUILIBRIUM' };
    var lookback = dailyKlines.slice(-48);
    var hi = -Infinity, lo = Infinity, i;
    for (i = 0; i < lookback.length; i++){
      var h = highOf(lookback[i]), l = lowOf(lookback[i]);
      if (fin(h) && h > hi) hi = h;
      if (fin(l) && l < lo) lo = l;
    }
    if (!fin(hi) || !fin(lo) || hi <= lo) return { percentile: null, zone: 'EQUILIBRIUM', eqPrice: null };
    var dist = hi - lo;
    var pct = +((currentPrice - lo) / dist).toFixed(3);
    var zone = pct <= 0.40 ? 'DEEP_DISCOUNT' : (pct < 0.50 ? 'DISCOUNT' : (pct >= 0.60 ? 'DEEP_PREMIUM' : (pct >= 0.50 ? 'PREMIUM' : 'EQUILIBRIUM')));
    return { percentile: pct, zone: zone, rangeHigh: +hi.toFixed(2), rangeLow: +lo.toFixed(2), eqPrice: +((hi + lo) / 2).toFixed(2) };
  };

  /* Dynamic 1% account-risk lot sizer (1 lot = $100 per point). */
  GoldTitanEngine.prototype.dynamicLots = function(accountEquity, riskFraction, entryPrice, stopLossPrice){
    accountEquity = num(accountEquity); riskFraction = num(riskFraction);
    entryPrice = num(entryPrice); stopLossPrice = num(stopLossPrice);
    if (!fin(accountEquity) || !fin(riskFraction)) return { lots: null, riskDollars: null, stopDistanceDollars: null };
    var riskDollars = accountEquity * riskFraction;
    var stopDistance = (fin(entryPrice) && fin(stopLossPrice)) ? Math.abs(entryPrice - stopLossPrice) : null;
    if (!fin(stopDistance) || stopDistance <= 0) return { lots: 0.10, riskDollars: +riskDollars.toFixed(2), stopDistanceDollars: null };
    var raw = riskDollars / (stopDistance * 100);
    var lots = +Math.max(0.01, Math.min(raw, 50.0)).toFixed(2);
    return { lots: lots, riskDollars: +riskDollars.toFixed(2), stopDistanceDollars: +stopDistance.toFixed(2), dollarPerPoint: +(lots * 100).toFixed(2) };
  };

  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function titanReport(goldKlines15m, dailyKlines, dxyKlines){
    var t = new GoldTitanEngine();
    var px = goldKlines15m && goldKlines15m.length ? closeOf(goldKlines15m[goldKlines15m.length - 1]) : null;
    var corr = t.pearsonCorrelation(goldKlines15m, dxyKlines, 30);
    var adr = t.adrExhaustion(dailyKlines, px, 20);
    var nymo = t.nymoTrueDayOpen(dailyKlines || goldKlines15m);
    var gann = fin(px) ? t.gannSquare9(px) : null;
    var deal = t.dealingRange(dailyKlines, px);
    var pools = t.restingLiquidityPools(goldKlines15m);
    return { px: px, corr: corr, adr: adr, nymo: nymo, gann: gann, deal: deal, pools: pools };
  }

  function titanStrip(report){
    if (!report) return '';
    var rows = [];
    var c = report.corr;
    if (c) rows.push('Pearson r ' + (c.r != null ? c.r : 'unread') + ' ' + (c.flightToSafety ? '- FLIGHT-TO-SAFETY' : ''));
    var a = report.adr;
    if (a && a.pctUsed != null) rows.push('ADR ' + a.pctUsed + '% used' + (a.exhausted ? ' - EXHAUSTED' : ' ($' + a.remainingDollars + ' room)'));
    if (report.nymo) rows.push('NYMO ' + (fin(report.nymo.nymo) ? '$' + report.nymo.nymo.toFixed(2) : 'unread'));
    if (report.gann) rows.push('Gann ' + report.gann.closestDegree + 'deg pivot $' + report.gann.closestLevel + ' (' + report.gann.distanceToGann + ' away' + (report.gann.isAtGannPivot ? ' - AT PIVOT' : '') + ')');
    if (report.deal) rows.push('Dealing ' + report.deal.zone + ' (' + (report.deal.percentile != null ? (report.deal.percentile * 100).toFixed(0) + '%' : 'unread') + ')');
    if (report.pools && report.pools.length) rows.push(report.pools.length + ' resting liquidity pools');
    if (!rows.length) return '';
    return '<div class="panel" data-hg-gold-titan="1" style="margin-top:8px"><h3>TITAN v7.0 TELEMETRY <span>correlation, ADR, NYMO, Gann, dealing range - evidence, never a gate</span></h3>'
      + '<div class="note">' + rows.map(esc).join(' | ') + '</div></div>';
  }

  var __ttSnap = null, __ttAt = 0;
  function hgGoldTitanRead(goldKlines15m, dailyKlines, dxyKlines){
    var r = titanReport(goldKlines15m, dailyKlines, dxyKlines);
    __ttSnap = r; __ttAt = Date.now();
    return r;
  }
  function hgGoldTitanState(){ return __ttSnap; }
  function hgGoldTitanStrip(){ return titanStrip(__ttSnap); }

  /* Self-mount into the gold tab panes (zero edits to the desks). */
  function mountInto(paneId){
    try{
      var pane = document.getElementById(paneId);
      if (!pane) return false;
      if (pane.querySelector && pane.querySelector('[data-hg-gold-titan]')) return true;
      var host = document.createElement('div');
      host.id = 'hgGoldTitanHost';
      host.setAttribute('data-hg-gold-titan', '1');
      pane.appendChild(host);
      return true;
    }catch(e){ return false; }
  }
  function paintHost(){
    try{
      var host = document.getElementById('hgGoldTitanHost');
      if (!host) return;
      var html = hgGoldTitanStrip();
      if (host.innerHTML !== html) host.innerHTML = html;
    }catch(e){}
  }
  function tryMountAll(){
    var ids = ['tab_goldscalp', 'tab_ganeshgold', 'tab_omnigold', 'tab_pinegold'];
    for (var i = 0; i < ids.length; i++) mountInto(ids[i]);
    paintHost();
  }
  var ticks = 0;
  var timer = (typeof setInterval === 'function') ? setInterval(function(){
    ticks += 1;
    tryMountAll();
    if (ticks > 240) { try{ clearInterval(timer); }catch(e){} }
  }, 5000) : null;

  var engine = new GoldTitanEngine();
  root.HG_GoldTitanEngine = GoldTitanEngine;
  root.hgGoldTitanPearson = engine.pearsonCorrelation.bind(engine);
  root.hgGoldTitanAdr = engine.adrExhaustion.bind(engine);
  root.hgGoldTitanNymo = engine.nymoTrueDayOpen.bind(engine);
  root.hgGoldTitanGann = engine.gannSquare9.bind(engine);
  root.hgGoldTitanSymmetry = engine.timePriceSymmetry.bind(engine);
  root.hgGoldTitanFootprint = engine.footprintAbsorption.bind(engine);
  root.hgGoldTitanDset = engine.doubleSweepExhaustion.bind(engine);
  root.hgGoldTitanOte = engine.oteGoldenPocket.bind(engine);
  root.hgGoldTitanCe = engine.consequentEncroachment.bind(engine);
  root.hgGoldTitanPools = engine.restingLiquidityPools.bind(engine);
  root.hgGoldTitanDealingRange = engine.dealingRange.bind(engine);
  root.hgGoldTitanLots = engine.dynamicLots.bind(engine);
  root.hgGoldTitanRead = hgGoldTitanRead;
  root.hgGoldTitanState = hgGoldTitanState;
  root.hgGoldTitanStrip = hgGoldTitanStrip;
  root.hgGoldTitanStop = function(){ try{ clearInterval(timer); }catch(e){} };
})(typeof globalThis !== 'undefined' ? globalThis : this);
