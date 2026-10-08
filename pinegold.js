/**
 * HARDGATE Pine Gold Library
 * Session-anchored VWAP (00:00, 07:00, 12:30 UTC) and a $3 institutional FVG.
 */
(function (root) {
  'use strict';
  function PineGoldEngine(){}
  function rowsOf(klines){ return root.hgGoldBars ? root.hgGoldBars(klines) : []; }
  PineGoldEngine.prototype.calculateSessionAvwap = function(klines){
    var rows = rowsOf(klines);
    var cumVol = 0, cumPx = 0, last = null, out = [], i, k, d, timeVal, session, tp, vol;
    for (i = 0; i < rows.length; i++){
      k = rows[i];
      d = new Date(k.time);
      timeVal = d.getUTCHours() + d.getUTCMinutes() / 60;
      session = 'ASIA';
      if (timeVal >= 7.0 && timeVal < 12.5) session = 'LONDON';
      else if (timeVal >= 12.5 && timeVal < 20.0) session = 'NY';
      else if (timeVal >= 20.0) session = 'OFF';
      if (session !== last){ cumVol = 0; cumPx = 0; last = session; }
      tp = (k.high + k.low + k.close) / 3;
      vol = k.volume > 0 ? k.volume : 1;
      cumVol += vol;
      cumPx += tp * vol;
      out.push({ time: k.time, session: session, avwap: +(cumPx / cumVol).toFixed(2) });
    }
    return out;
  };
  PineGoldEngine.prototype.detectGoldFvg = function(klines, minDollarGap){
    if (minDollarGap == null) minDollarGap = 3.00;
    var rows = rowsOf(klines), fvgs = [], i, c0, c1, c2, fvg, j, k;
    if (rows.length < 3) return fvgs;
    for (i = 2; i < rows.length; i++){
      c0 = rows[i - 2]; c1 = rows[i - 1]; c2 = rows[i];
      if (c2.low - c0.high >= minDollarGap && c1.close > c1.open){
        fvgs.push({ type: 'BULLISH_FVG', top: c2.low, bottom: c0.high, sizeDollars: +(c2.low - c0.high).toFixed(2), barIndex: i - 1, time: c1.time, mitigated: false });
      }
      if (c0.low - c2.high >= minDollarGap && c1.close < c1.open){
        fvgs.push({ type: 'BEARISH_FVG', top: c0.low, bottom: c2.high, sizeDollars: +(c0.low - c2.high).toFixed(2), barIndex: i - 1, time: c1.time, mitigated: false });
      }
    }
    for (i = 0; i < fvgs.length; i++){
      fvg = fvgs[i];
      for (j = fvg.barIndex + 2; j < rows.length; j++){
        k = rows[j];
        if (fvg.type === 'BULLISH_FVG' && k.low <= fvg.top){ fvg.mitigated = true; break; }
        if (fvg.type === 'BEARISH_FVG' && k.high >= fvg.bottom){ fvg.mitigated = true; break; }
      }
    }
    return fvgs;
  };
  PineGoldEngine.prototype.calculateSessionAvwapBands = function(klines){
    var rows = rowsOf(klines);
    var cumVol = 0, cumPx = 0, cumDev = 0, last = null, out = [], i, k, d, timeVal, session, typical, vol, avwap, sd;
    for (i = 0; i < rows.length; i++){
      k = rows[i];
      d = new Date(k.time);
      timeVal = d.getUTCHours() + d.getUTCMinutes() / 60;
      session = 'ASIA';
      if (timeVal >= 7.0 && timeVal < 12.5) session = 'LONDON';
      else if (timeVal >= 12.5 && timeVal < 20.0) session = 'NY';
      else if (timeVal >= 20.0) session = 'OFF';
      if (session !== last){ cumVol = 0; cumPx = 0; cumDev = 0; last = session; }
      typical = (k.high + k.low + k.close) / 3;
      vol = k.volume > 0 ? k.volume : 1;
      cumVol += vol;
      cumPx += typical * vol;
      avwap = cumPx / cumVol;
      cumDev += vol * Math.pow(typical - avwap, 2);
      sd = Math.sqrt(cumDev / cumVol);
      out.push({ time: k.time, session: session, avwap: +avwap.toFixed(2), upperBand1: +(avwap + sd).toFixed(2), lowerBand1: +(avwap - sd).toFixed(2), upperBand2: +(avwap + 2 * sd).toFixed(2), lowerBand2: +(avwap - 2 * sd).toFixed(2) });
    }
    return out;
  };
  PineGoldEngine.prototype.detectBalancedPriceRanges = function(klines, minGapDollars){
    if (minGapDollars == null) minGapDollars = 2;
    var rows = rowsOf(klines), fvgs = [], bprs = [], i, c0, c1, c2, f1, f2, top, bot;
    if (rows.length < 6) return bprs;
    for (i = 2; i < rows.length; i++){
      c0 = rows[i - 2]; c1 = rows[i - 1]; c2 = rows[i];
      if (c2.low - c0.high >= minGapDollars && c1.close > c1.open) fvgs.push({ type: 'BULL', top: c2.low, bottom: c0.high, barIndex: i - 1 });
      if (c0.low - c2.high >= minGapDollars && c1.close < c1.open) fvgs.push({ type: 'BEAR', top: c0.low, bottom: c2.high, barIndex: i - 1 });
    }
    for (i = 0; i < fvgs.length - 1; i++){
      f1 = fvgs[i]; f2 = fvgs[i + 1];
      if (f1.type === f2.type || Math.abs(f1.barIndex - f2.barIndex) > 12) continue;
      top = Math.min(f1.top, f2.top);
      bot = Math.max(f1.bottom, f2.bottom);
      if (top > bot) bprs.push({ top: +top.toFixed(2), bottom: +bot.toFixed(2), mid: +((top + bot) / 2).toFixed(2), size: +(top - bot).toFixed(2) });
    }
    return bprs;
  };
  PineGoldEngine.prototype.calculateValueArea = function(dayKlines, valueAreaPct){
    if (valueAreaPct == null) valueAreaPct = 0.70;
    var rows = rowsOf(dayKlines);
    if (rows.length < 15) return null;
    var buckets = {}, total = 0, i, price, vol, key, poc = null, max = -1, target, got = 0, prices = [], list, p;
    for (i = 0; i < rows.length; i++){
      price = Math.round(rows[i].close * 2) / 2;
      vol = rows[i].volume > 0 ? rows[i].volume : 1;
      key = price.toFixed(2);
      buckets[key] = (buckets[key] || 0) + vol;
      total += vol;
    }
    list = Object.keys(buckets);
    for (i = 0; i < list.length; i++){
      if (buckets[list[i]] > max){ max = buckets[list[i]]; poc = +list[i]; }
    }
    target = total * valueAreaPct;
    list.sort(function(a, b){ return buckets[b] - buckets[a]; });
    for (i = 0; i < list.length; i++){
      got += buckets[list[i]];
      prices.push(+list[i]);
      if (got >= target) break;
    }
    return { poc: poc, vah: +Math.max.apply(null, prices).toFixed(2), val: +Math.min.apply(null, prices).toFixed(2), totalVolume: total, equalWeight: rows.every(function(r){ return !(r.volume > 0); }) };
  };
  PineGoldEngine.prototype.detectFreshFvgs = function(klines, minGapDollars){
    if (minGapDollars == null) minGapDollars = 2.5;
    var rows = rowsOf(klines), fvgs = [], i, c0, c1, c2, j, k, fvg, top, bottom;
    if (rows.length < 5) return fvgs;
    for (i = 2; i < rows.length; i++){
      c0 = rows[i - 2]; c1 = rows[i - 1]; c2 = rows[i];
      if (c2.low - c0.high >= minGapDollars && c1.close > c1.open){
        top = c2.low; bottom = c0.high;
        fvgs.push({ type: 'BULLISH_FVG', top: top, bottom: bottom, ce50: +((top + bottom) / 2).toFixed(2), barIndex: i - 1, state: 'FRESH' });
      }
      if (c0.low - c2.high >= minGapDollars && c1.close < c1.open){
        top = c0.low; bottom = c2.high;
        fvgs.push({ type: 'BEARISH_FVG', top: top, bottom: bottom, ce50: +((top + bottom) / 2).toFixed(2), barIndex: i - 1, state: 'FRESH' });
      }
    }
    for (i = 0; i < fvgs.length; i++){
      fvg = fvgs[i];
      for (j = fvg.barIndex + 2; j < rows.length; j++){
        k = rows[j];
        if (fvg.type === 'BULLISH_FVG'){
          if (k.low <= fvg.bottom){ fvg.state = 'EXHAUSTED'; break; }
          if (k.low <= fvg.ce50) fvg.state = 'PARTIALLY_MITIGATED';
        } else {
          if (k.high >= fvg.top){ fvg.state = 'EXHAUSTED'; break; }
          if (k.high >= fvg.ce50) fvg.state = 'PARTIALLY_MITIGATED';
        }
      }
    }
    return fvgs;
  };
  PineGoldEngine.prototype.detectVolumeImbalances = function(klines){
    return root.HG_GoldCoreEngine ? new root.HG_GoldCoreEngine().detectVolumeImbalance(klines) : null;
  };
  PineGoldEngine.prototype.generateGannGrid = function(anchor, price){
    var g = root.HG_GoldCoreEngine ? new root.HG_GoldCoreEngine().calculateGannSquare9(anchor, price || anchor) : null;
    return g && g.levels ? g.levels : [];
  };
  PineGoldEngine.prototype.mapRestingLiquidityPools = function(klines){
    var rows = rowsOf(klines), pools = [], i, j, high, low, swingHigh, swingLow, later;
    if (rows.length < 20) return pools;
    for (i = 5; i < rows.length - 5; i++){
      high = rows[i].high; low = rows[i].low; swingHigh = true; swingLow = true;
      for (j = i - 5; j < i; j++){ if (rows[j].high >= high) swingHigh = false; if (rows[j].low <= low) swingLow = false; }
      for (j = i + 1; j <= i + 5; j++){ if (rows[j].high >= high) swingHigh = false; if (rows[j].low <= low) swingLow = false; }
      if (swingHigh){
        later = false;
        for (j = i + 1; j < rows.length; j++) if (rows[j].high >= high) later = true;
        if (!later) pools.push({ type: 'BUY_SIDE', price: high });
      }
      if (swingLow){
        later = false;
        for (j = i + 1; j < rows.length; j++) if (rows[j].low <= low) later = true;
        if (!later) pools.push({ type: 'SELL_SIDE', price: low });
      }
    }
    return pools.slice(-6);
  };
  root.HG_PineGoldEngine = PineGoldEngine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
