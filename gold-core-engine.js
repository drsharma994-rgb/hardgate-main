/**
 * HARDGATE Gold Core Engine (XAU/USD)
 * Session killzones, macro veto, dollar ATR, Asian range.
 * Bars are {t,o,h,l,c,v} or {time,open,high,low,close,volume}.
 * Session and vetoes are read off the last closed bar, not the wall clock.
 */
(function (root) {
  'use strict';

  var GoldSessions = {
    ASIA: 'ASIA',
    LONDON_OPEN: 'LONDON_OPEN',
    LONDON_FIX: 'LONDON_FIX',
    NY_OPEN: 'NY_OPEN',
    NY_CLOSE: 'NY_CLOSE',
    OFF_HOURS: 'OFF_HOURS'
  };

  function fin(v){ return typeof v === 'number' && isFinite(v); }
  function num(v){ var n = (typeof v === 'number') ? v : +v; return fin(n) ? n : NaN; }

  function bar(k){
    if (!k) return null;
    var open = num(k.open != null ? k.open : k.o);
    var high = num(k.high != null ? k.high : k.h);
    var low = num(k.low != null ? k.low : k.l);
    var close = num(k.close != null ? k.close : k.c);
    var volume = num(k.volume != null ? k.volume : k.v);
    var t = num(k.time != null ? k.time : k.t);
    if (![open, high, low, close].every(fin)) return null;
    if (fin(t) && t < 1e12) t = t * 1000;
    return { open: open, high: high, low: low, close: close, volume: fin(volume) ? volume : 0, time: fin(t) ? t : NaN };
  }

  function barsOf(rows){
    var out = [];
    if (!rows) return out;
    for (var i = 0; i < rows.length; i++){
      var b = bar(rows[i]);
      if (b) out.push(b);
    }
    return out;
  }

  function GoldCoreEngine(){
    this.minAtrDollars = 2.50;
  }

  GoldCoreEngine.prototype.getCurrentSession = function(date){
    date = date || new Date();
    var timeVal = date.getUTCHours() + (date.getUTCMinutes() / 60);
    if (timeVal >= 0 && timeVal < 7.0) return GoldSessions.ASIA;
    if (timeVal >= 7.0 && timeVal < 10.0) return GoldSessions.LONDON_OPEN;
    if (timeVal >= 10.0 && timeVal < 11.0) return GoldSessions.LONDON_FIX;
    if (timeVal >= 12.5 && timeVal < 15.5) return GoldSessions.NY_OPEN;
    if (timeVal >= 16.0 && timeVal < 20.0) return GoldSessions.NY_CLOSE;
    return GoldSessions.OFF_HOURS;
  };

  /* Rollover and the two London benchmarks only.
     OFF_HOURS also covers 11:00-12:30 and 15:30-16:00, which are not the
     spread spike. Those hours are not a veto here. The scalp engine still
     idles outside London Open and NY Open. */
  GoldCoreEngine.prototype.getInstitutionalSession = function(date){
    date = date || new Date();
    var timeVal = date.getUTCHours() + date.getUTCMinutes() / 60;
    var isLondonIb = timeVal >= 7.0 && timeVal < 7.5;
    var isLondonApex = timeVal >= 7.5 && timeVal <= 8.75;
    var isLondonOpen = timeVal >= 7.0 && timeVal < 10.0;
    var isNyIb = timeVal >= 13.5 && timeVal < 14.0;
    var isNyApex = timeVal >= 14.0 && timeVal <= 15.25;
    var isNyExpansion = timeVal >= 12.5 && timeVal < 16.0;
    var isFix = (timeVal >= 10.3 && timeVal <= 10.75) || (timeVal >= 14.85 && timeVal <= 15.2);
    var name = 'OFF_HOURS';
    if (isLondonIb) name = 'LONDON_IB';
    else if (isNyIb) name = 'NY_IB';
    else if (isLondonApex) name = 'LONDON_APEX';
    else if (isNyApex) name = 'NY_APEX';
    else if (isLondonOpen) name = 'LONDON_OPEN';
    else if (isNyExpansion) name = 'NY_EXPANSION';
    else if (timeVal >= 0 && timeVal < 7) name = 'ASIA';
    else if (timeVal >= 16 && timeVal < 20) name = 'NY_CLOSE';
    return {
      sessionName: name,
      isIbWindow: !!(isLondonIb || isNyIb),
      isApex: !!(isLondonApex || isNyApex),
      isKillzone: !!(isLondonOpen || isNyExpansion),
      isFixWindow: !!isFix
    };
  };
  GoldCoreEngine.prototype.calculateDealingRange = function(dayKlines, currentPrice, lookbackBars){
    var rows = barsOf(dayKlines);
    if (rows.length < 15 || !(currentPrice > 0)) return { percentile: 0.5, zone: 'EQUILIBRIUM', unread: true };
    var span = lookbackBars >= 144 ? 144 : (lookbackBars >= 89 ? 89 : (lookbackBars >= 55 ? 55 : (lookbackBars >= 34 ? 34 : 48)));
    if (!(lookbackBars > 0)) span = 48;
    var look = rows.slice(-span);
    var hi = -Infinity, lo = Infinity, i;
    for (i = 0; i < look.length; i++){ if (look[i].high > hi) hi = look[i].high; if (look[i].low < lo) lo = look[i].low; }
    var dist = hi - lo;
    if (!(dist > 0)) return { percentile: 0.5, zone: 'EQUILIBRIUM', eqPrice: currentPrice, rangeHigh: hi, rangeLow: lo };
    var percentile = +((currentPrice - lo) / dist).toFixed(3);
    var zone = 'EQUILIBRIUM';
    if (percentile <= 0.40) zone = 'DEEP_DISCOUNT';
    else if (percentile < 0.50) zone = 'DISCOUNT';
    else if (percentile >= 0.60) zone = 'DEEP_PREMIUM';
    else if (percentile > 0.50) zone = 'PREMIUM';
    return { percentile: percentile, zone: zone, rangeHigh: hi, rangeLow: lo, eqPrice: +((hi + lo) / 2).toFixed(2), bars: look.length, unread: false };
  };
  function nyParts(ms){
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
      var o = {}, i;
      for (i = 0; i < parts.length; i++) if (parts[i].type !== 'literal') o[parts[i].type] = parts[i].value;
      return o;
    } catch (e) { return null; }
  }
  GoldCoreEngine.prototype.calculateTrueDayOpen = function(dayKlines){
    var rows = barsOf(dayKlines);
    if (!rows.length) return { nymo: null, unread: true };
    var lastNy = nyParts(rows[rows.length - 1].time);
    if (!lastNy) return { nymo: null, unread: true };
    var i, c, part;
    for (i = rows.length - 1; i >= 0; i--){
      c = rows[i];
      part = nyParts(c.time);
      if (!part || part.year !== lastNy.year || part.month !== lastNy.month || part.day !== lastNy.day) continue;
      if ((part.hour === '00' || part.hour === '24') && part.minute === '00') return { nymo: c.open, time: c.time, unread: false, source: 'NY' };
    }
    var day = new Date(rows[rows.length - 1].time);
    for (i = 0; i < rows.length; i++){
      c = rows[i];
      var dt = new Date(c.time);
      if (dt.getUTCFullYear() === day.getUTCFullYear() && dt.getUTCMonth() === day.getUTCMonth() && dt.getUTCDate() === day.getUTCDate() && dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0){
        return { nymo: c.open, time: c.time, unread: false, source: 'UTC' };
      }
    }
    return { nymo: null, unread: true };
  };
  GoldCoreEngine.prototype.calculateKineticEnergy = function(klines, atr){
    var rows = barsOf(klines);
    if (rows.length < 5 || !(atr > 0)) return { safe: true, velocityScore: 0, downCascade: false, upCascade: false };
    var c0 = rows[rows.length - 1], c1 = rows[rows.length - 2], c2 = rows[rows.length - 3];
    var score = +(Math.abs(c0.close - c2.open) / (atr * 2.8)).toFixed(2);
    var falling = c0.close < c1.close && c1.close < c2.close;
    var rising = c0.close > c1.close && c1.close > c2.close;
    return { velocityScore: score, downCascade: score > 1.5 && falling, upCascade: score > 1.5 && rising, safe: !(score > 1.5 && (falling || rising)) };
  };
  GoldCoreEngine.prototype.detectPocMigration = function(klines){
    var rows = barsOf(klines);
    if (rows.length < 16) return { trappedSide: 'NONE', unread: true };
    var window = rows.slice(-32);
    var half = Math.floor(window.length / 2);
    function pocOf(list){
      var buckets = {}, i, key, vol, max = -1, at = null;
      for (i = 0; i < list.length; i++){
        key = (Math.round(list[i].close * 2) / 2).toFixed(2);
        vol = list[i].volume > 0 ? list[i].volume : 1;
        buckets[key] = (buckets[key] || 0) + vol;
        if (buckets[key] > max){ max = buckets[key]; at = +key; }
      }
      return at;
    }
    var early = pocOf(window.slice(0, half)), recent = pocOf(window.slice(half));
    var px = rows[rows.length - 1].close, side = 'NONE';
    if (early != null && recent != null && recent > early && px < recent) side = 'TRAPPED_LONGS';
    else if (early != null && recent != null && recent < early && px > recent) side = 'TRAPPED_SHORTS';
    return { trappedSide: side, earlyPoc: early, recentPoc: recent, pocShift: early != null && recent != null ? +(recent - early).toFixed(2) : 0, unread: false };
  };
  GoldCoreEngine.prototype.calculateTrailingBreakeven = function(entryPrice, direction, atr){
    var buffer = +((atr > 0 ? atr : 0) * 0.35).toFixed(2);
    var bull = direction === 'BULL' || direction === 'long';
    return { breakevenStop: +(bull ? entryPrice + buffer : entryPrice - buffer).toFixed(2), buffer: buffer };
  };
  GoldCoreEngine.prototype.calculateAdrExhaustion = function(klines){
    var rows = barsOf(klines);
    if (rows.length < 20) return { unread: true, exhausted: false, pctUsed: 0, remainingDollars: null };
    var days = {}, order = [], i, c, key, dt, rec;
    for (i = 0; i < rows.length; i++){
      c = rows[i];
      if (!fin(c.time)) continue;
      dt = new Date(c.time);
      key = dt.getUTCFullYear() + '-' + dt.getUTCMonth() + '-' + dt.getUTCDate();
      rec = days[key];
      if (!rec){ rec = days[key] = { high: -Infinity, low: Infinity, n: 0 }; order.push(key); }
      if (c.high > rec.high) rec.high = c.high;
      if (c.low < rec.low) rec.low = c.low;
      rec.n++;
    }
    if (order.length < 2) return { unread: true, exhausted: false, pctUsed: 0, remainingDollars: null };
    var today = days[order[order.length - 1]];
    var prior = [];
    for (i = 0; i < order.length - 1; i++) if (days[order[i]].n >= 8) prior.push(days[order[i]].high - days[order[i]].low);
    prior = prior.slice(-20);
    if (prior.length < 5 || !(today.high > today.low)) return { unread: true, exhausted: false, pctUsed: 0, remainingDollars: null, todayHigh: today.high, todayLow: today.low };
    var sum = 0;
    for (i = 0; i < prior.length; i++) sum += prior[i];
    var adr = +(sum / prior.length).toFixed(2);
    var used = +(today.high - today.low).toFixed(2);
    var pct = +((used / adr) * 100).toFixed(1);
    var pos = (rows[rows.length - 1].close - today.low) / (today.high - today.low);
    return {
      unread: false, adrDollars: adr, usedDollars: used, pctUsed: pct, exhausted: pct >= 90,
      remainingDollars: +Math.max(0, adr - used).toFixed(2), todayHigh: today.high, todayLow: today.low,
      position: +pos.toFixed(3), days: prior.length
    };
  };
  GoldCoreEngine.prototype.calculateCvdAbsorption = function(klines, direction){
    var rows = barsOf(klines);
    if (rows.length < 8) return { unread: true, confirmed: false, deltaDivergence: false, recentDelta: 0 };
    var recent = rows.slice(-8), real = false, deltas = [], i, k, range, buy, sell;
    for (i = 0; i < recent.length; i++){
      k = recent[i];
      if (k.volume > 1) real = true;
      range = k.high - k.low;
      buy = range > 0 ? (k.volume > 0 ? k.volume : 0) * ((k.close - k.low) / range) : 0;
      sell = (k.volume > 0 ? k.volume : 0) - buy;
      deltas.push(buy - sell);
    }
    if (!real) return { unread: true, confirmed: false, deltaDivergence: false, recentDelta: 0, note: 'no exchange volume' };
    function sum(a, b){ var s = 0, j; for (j = a; j < b; j++) s += deltas[j]; return s; }
    var recentDelta = sum(5, 8), prevDelta = sum(0, 3);
    var c0 = recent[7], cPrev = recent[5];
    var bull = direction === 'BULL' || direction === 'long';
    var divergence = bull ? (c0.low <= cPrev.low && recentDelta > prevDelta) : (c0.high >= cPrev.high && recentDelta < prevDelta);
    var confirmed = divergence || (bull ? recentDelta > 0 : recentDelta < 0);
    return { unread: false, confirmed: confirmed, deltaDivergence: divergence, recentDelta: +recentDelta.toFixed(1) };
  };
  GoldCoreEngine.prototype.calculateGannSquare9 = function(anchor, price){
    if (!(anchor > 0) || !(price > 0)) return { unread: true, isAtGannPivot: false, distanceToGann: null };
    var root = Math.sqrt(anchor), angles = [90, 180, 270, 360], levels = [], i, factor, up, down, best = Infinity, level = null, degree = null;
    for (i = 0; i < angles.length; i++){
      factor = angles[i] / 180;
      up = +Math.pow(root + factor, 2).toFixed(2);
      down = +Math.pow(Math.max(0.01, root - factor), 2).toFixed(2);
      levels.push({ degree: angles[i], harmonicUp: up, harmonicDown: down });
      if (Math.abs(price - up) < best){ best = Math.abs(price - up); level = up; degree = angles[i]; }
      if (Math.abs(price - down) < best){ best = Math.abs(price - down); level = down; degree = angles[i]; }
    }
    return { unread: false, levels: levels, closestLevel: level, closestDegree: degree, distanceToGann: +best.toFixed(2), isAtGannPivot: best <= 1.20, anchor: anchor };
  };
  GoldCoreEngine.prototype.detectVolumeImbalance = function(klines){
    var rows = barsOf(klines), out = [], i, a, b, aLo, aHi, bLo, bHi;
    for (i = Math.max(1, rows.length - 8); i < rows.length; i++){
      a = rows[i - 1]; b = rows[i];
      aLo = Math.min(a.open, a.close); aHi = Math.max(a.open, a.close);
      bLo = Math.min(b.open, b.close); bHi = Math.max(b.open, b.close);
      if (bLo - aHi >= 0.80) out.push({ type: 'BULLISH_VI', gapTop: +bLo.toFixed(2), gapBottom: +aHi.toFixed(2), gapSize: +(bLo - aHi).toFixed(2) });
      if (aLo - bHi >= 0.80) out.push({ type: 'BEARISH_VI', gapTop: +aLo.toFixed(2), gapBottom: +bHi.toFixed(2), gapSize: +(aLo - bHi).toFixed(2) });
    }
    return out.length ? out[out.length - 1] : null;
  };
  GoldCoreEngine.prototype.calculateInitialBalance = function(dayKlines){
    var rows = barsOf(dayKlines);
    if (!rows.length) return { londonIb: null, nyIb: null };
    var last = new Date(rows[rows.length - 1].time);
    var y = last.getUTCFullYear(), mo = last.getUTCMonth(), d = last.getUTCDate();
    var lon = [], ny = [], i, c, dt, tv;
    for (i = 0; i < rows.length; i++){
      c = rows[i];
      if (!fin(c.time)) continue;
      dt = new Date(c.time);
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) continue;
      tv = dt.getUTCHours() + dt.getUTCMinutes() / 60;
      if (tv >= 7.0 && tv < 7.5) lon.push(c);
      if (tv >= 13.5 && tv < 14.0) ny.push(c);
    }
    function box(list){
      if (!list.length) return null;
      var h = -Infinity, l = Infinity, j;
      for (j = 0; j < list.length; j++){ if (list[j].high > h) h = list[j].high; if (list[j].low < l) l = list[j].low; }
      return { ibh: h, ibl: l };
    }
    return { londonIb: box(lon), nyIb: box(ny) };
  };
  GoldCoreEngine.prototype.calculateFootprintAbsorption = function(candle, direction){
    var c = barsOf([candle])[0] || candle;
    var total = c.high - c.low;
    if (!(total > 0)) return { absorbed: false, absorptionRatio: 0 };
    var wick = direction === 'BULL' || direction === 'long'
      ? (Math.min(c.open, c.close) - c.low)
      : (c.high - Math.max(c.open, c.close));
    var ratio = +(wick / total).toFixed(2);
    return { absorbed: ratio >= 0.58, absorptionRatio: ratio };
  };
  GoldCoreEngine.prototype.checkTimeVeto = function(date){
    date = date || new Date();
    var h = date.getUTCHours(), m = date.getUTCMinutes();
    if (h >= 21 || (h === 20 && m >= 45)) return { veto: true, reason: 'Off-hours rollover: high spread and low depth' };
    var sess = this.getInstitutionalSession(date);
    if (sess.isFixWindow) return { veto: true, reason: 'London Fix window (10:30/15:00 UTC benchmark rebalance)' };
    return { veto: false, reason: 'Timing valid' };
  };
  GoldCoreEngine.prototype.classifyAsianRegime = function(dayKlines, currentPrice){
    var rows = barsOf(dayKlines);
    if (rows.length < 4) return { regime: 'UNKNOWN', rangeDollars: 0, rangePct: 0, drift: 'FLAT' };
    var last = rows[rows.length - 1];
    var px = currentPrice > 0 ? currentPrice : last.close;
    var day = new Date(last.time);
    var y = day.getUTCFullYear(), mo = day.getUTCMonth(), d = day.getUTCDate();
    var ash = -Infinity, asl = Infinity, n = 0, firstOpen = NaN, lastClose = NaN, i, c, dt;
    for (i = 0; i < rows.length; i++){
      c = rows[i];
      if (!fin(c.time)) continue;
      dt = new Date(c.time);
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) continue;
      if (dt.getUTCHours() >= 7) continue;
      if (c.high > ash) ash = c.high;
      if (c.low < asl) asl = c.low;
      if (!fin(firstOpen)) firstOpen = c.open;
      lastClose = c.close;
      n++;
    }
    if (n < 4 || !(ash > asl) || !(px > 0)) return { regime: 'UNKNOWN', rangeDollars: 0, rangePct: 0, drift: 'FLAT' };
    var rangeDollars = +(ash - asl).toFixed(2);
    var rangePct = +((rangeDollars / px) * 100).toFixed(2);
    var regime = 'CONSOLIDATION';
    if (rangePct > 1.10) regime = 'EXPANSION_TREND';
    else if (rangePct >= 0.65) regime = 'NORMAL_VARIANCE';
    var drift = 'FLAT';
    if (fin(firstOpen) && fin(lastClose)){
      if (lastClose < firstOpen - rangeDollars * 0.25) drift = 'DOWN';
      else if (lastClose > firstOpen + rangeDollars * 0.25) drift = 'UP';
    }
    return { regime: regime, ash: ash, asl: asl, mid: (ash + asl) / 2, rangeDollars: rangeDollars, rangePct: rangePct, drift: drift, bars: n };
  };
  GoldCoreEngine.prototype.evaluateTripleSmt = function(goldKlines, silverKlines){
    var g = barsOf(goldKlines), s = barsOf(silverKlines);
    var out = { tripleSmtBullish: false, tripleSmtBearish: false, silverConfirmed: false, unread: true };
    if (g.length < 5 || s.length < 5) return out;
    var g0 = g[g.length - 1], g1 = g[g.length - 3], s0 = s[s.length - 1], s1 = s[s.length - 3];
    out.unread = false;
    out.tripleSmtBullish = g0.low < g1.low && !(s0.low < s1.low);
    out.tripleSmtBearish = g0.high > g1.high && !(s0.high > s1.high);
    out.silverConfirmed = out.tripleSmtBullish || out.tripleSmtBearish;
    return out;
  };
  GoldCoreEngine.prototype.detectBreakerBlock = function(klines){
    var rows = barsOf(klines);
    if (rows.length < 8) return null;
    var atr = this.calculateAtr(rows, 14);
    var found = null, i, origin, sweep, disp, body, start = Math.max(3, rows.length - 20);
    for (i = start; i < rows.length; i++){
      origin = rows[i - 3]; sweep = rows[i - 2]; disp = rows[i];
      body = Math.abs(disp.close - disp.open);
      if (origin.close < origin.open && sweep.low < origin.low && disp.close > origin.high && disp.close > disp.open && body >= atr * 1.2)
        found = { type: 'BULLISH_BREAKER', levelHigh: origin.high, levelLow: origin.low, barIndex: i };
      if (origin.close > origin.open && sweep.high > origin.high && disp.close < origin.low && disp.close < disp.open && body >= atr * 1.2)
        found = { type: 'BEARISH_BREAKER', levelHigh: origin.high, levelLow: origin.low, barIndex: i };
    }
    if (!found) return null;
    var last = rows[rows.length - 1];
    found.retesting = last.low <= found.levelHigh && last.high >= found.levelLow;
    return found;
  };

  GoldCoreEngine.prototype.calculateAsianRange = function(dayKlines){
    var rows = barsOf(dayKlines);
    if (rows.length < 4) return null;
    var last = rows[rows.length - 1];
    if (!fin(last.time)) return null;
    var day = new Date(last.time);
    var y = day.getUTCFullYear(), m = day.getUTCMonth(), d = day.getUTCDate();
    var high = -Infinity, low = Infinity, n = 0, i, c, dt;
    for (i = 0; i < rows.length; i++){
      c = rows[i];
      if (!fin(c.time)) continue;
      dt = new Date(c.time);
      if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) continue;
      if (dt.getUTCHours() >= 7) continue;
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      n++;
    }
    if (n < 4 || !(high > low)) return null;
    return { ash: high, asl: low, mid: (high + low) / 2, rangeDollars: +(high - low).toFixed(2), bars: n };
  };

  GoldCoreEngine.prototype.evaluateMacroAlignment = function(direction, macroData){
    macroData = macroData || {};
    var dxyTrend = macroData.dxyTrend || 'FLAT';
    var us10yTrend = macroData.us10yTrend || 'FLAT';
    var pass = true, reasons = [];
    if (direction === 'BULL'){
      if (dxyTrend === 'UP_EXPANDING'){ pass = false; reasons.push('DXY expanding upwards (strong dollar headwind)'); }
      if (us10yTrend === 'UP_EXPANDING'){ pass = false; reasons.push('US 10Y real yields surging'); }
    } else if (direction === 'BEAR'){
      if (dxyTrend === 'DOWN_EXPANDING'){ pass = false; reasons.push('DXY crashing (safe-haven dollar drain into gold)'); }
      if (us10yTrend === 'DOWN_EXPANDING'){ pass = false; reasons.push('US 10Y yields collapsing'); }
    }
    return { pass: pass, reasons: reasons.length ? reasons.join('; ') : 'Macro tailwinds clean' };
  };

  GoldCoreEngine.prototype.calculateAtr = function(klines, period){
    period = period || 14;
    var rows = barsOf(klines);
    if (rows.length < period + 1) return 3.50;
    var sum = 0, i, h, l, prevC;
    for (i = rows.length - period; i < rows.length; i++){
      h = rows[i].high; l = rows[i].low; prevC = rows[i - 1].close;
      sum += Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    }
    var atr = sum / period;
    return atr > 0 ? +atr.toFixed(2) : 3.50;
  };

  function expandTrend(node, upName, downName, band){
    if (!node || typeof node !== 'object') return 'FLAT';
    var trend = String(node.trend20 || node.trend || '').toUpperCase();
    var chg = num(node.change20Pct);
    if (trend === 'RISING' && (!fin(chg) || chg >= band)) return fin(chg) && chg >= band ? upName : 'FLAT';
    if (trend === 'FALLING' && (!fin(chg) || chg <= -band)) return fin(chg) && chg <= -band ? downName : 'FLAT';
    if (trend === 'RISING' && fin(chg) && chg >= band) return upName;
    if (trend === 'FALLING' && fin(chg) && chg <= -band) return downName;
    return 'FLAT';
  }

  function macroView(macro){
    macro = macro || {};
    var dxy = macro.dxy || null;
    var real = (macro.realRateMeasured && macro.realRateMeasured.measured) ? macro.realRateMeasured : (macro.realYield || null);
    var realNode = real;
    if (real && real.trend && !real.trend20) realNode = { trend20: real.trend, change20Pct: real.change20Pct != null ? real.change20Pct : real.chg20d };
    return {
      dxyTrend: expandTrend(dxy, 'UP_EXPANDING', 'DOWN_EXPANDING', 0.6),
      us10yTrend: expandTrend(realNode, 'UP_EXPANDING', 'DOWN_EXPANDING', 1.5),
      dxyRaw: dxy && (dxy.trend20 || dxy.trend) || 'UNREAD',
      yieldRaw: realNode && (realNode.trend20 || realNode.trend) || 'UNREAD'
    };
  }

  function side(dir){
    var d = String(dir || '').toLowerCase();
    if (d === 'long' || d === 'bull' || d === 'buy') return 'BULL';
    if (d === 'short' || d === 'bear' || d === 'sell') return 'BEAR';
    return null;
  }

  function lastDate(rows){
    var b = barsOf(rows);
    if (!b.length || !fin(b[b.length - 1].time)) return null;
    return new Date(b[b.length - 1].time);
  }

  function sweepState(rows){
    var core = new GoldCoreEngine();
    var asia = core.calculateAsianRange(rows);
    var b = barsOf(rows);
    if (!asia || b.length < 2) return { asia: asia, open: null };
    var cur = b[b.length - 1], prev = b[b.length - 2];
    var sweptLow = cur.low < asia.asl || prev.low < asia.asl;
    var reclaimedLow = cur.close > asia.asl && cur.close > cur.open && (cur.high > cur.low) && (cur.close - cur.low) > (cur.high - cur.low) * 0.50;
    var sweptHigh = cur.high > asia.ash || prev.high > asia.ash;
    var reclaimedHigh = cur.close < asia.ash && cur.close < cur.open && (cur.high > cur.low) && (cur.high - cur.close) > (cur.high - cur.low) * 0.50;
    /* Still outside the Asian box means the run has not reclaimed. A wick
       that tags the other side and closes back inside is not an open sweep. */
    var open = null;
    if (cur.close < asia.asl || cur.close > asia.ash) open = 'OUT';
    return { asia: asia, open: open, reclaimedBull: !!(sweptLow && reclaimedLow), reclaimedBear: !!(sweptHigh && reclaimedHigh) };
  }

  function hgGoldInstBlocks(dir, rows, macro, opts){
    opts = opts || {};
    var core = new GoldCoreEngine();
    var want = side(dir);
    if (!want) return null;
    if (typeof root.hgMacroEventLock === 'function'){
      try {
        var lock = root.hgMacroEventLock();
        if (lock && lock.veto) return lock.evidence || 'High-impact USD event';
      } catch (eLock) {}
    }
    var when = lastDate(rows);
    if (!when) return null;
    var veto = core.checkTimeVeto(when);
    if (veto.veto) return veto.reason;
    var session = core.getCurrentSession(when);
    if (session === GoldSessions.ASIA) return 'Asian session trap: 00:00-07:00 UTC breakouts are not a lead';
    var view = macroView(macro);
    var aligned = core.evaluateMacroAlignment(want, view);
    if (!aligned.pass) return aligned.reasons;
    var sw = sweepState(rows);
    if (sw.open === 'OUT') return 'Judas sweep still running: wait for the reclaim close';
    if (!root.__hgSilverRows && typeof root.getSilverCandles === 'function' && !root.__hgSilverBusy){
      root.__hgSilverBusy = true;
      Promise.resolve(root.getSilverCandles('15m', 120)).then(function(s){
        root.__hgSilverRows = (s && s.rows) || [];
      }).catch(function(){}).then(function(){ root.__hgSilverBusy = false; });
    }
    var scalpDesk = opts.horizon !== 'swing' && opts.horizon !== 'SWING' && String(opts.desk || '') !== 'ganesh-swing'
      && String(opts.horizon || '').toLowerCase().indexOf('swing') < 0;
    if (scalpDesk){
      var atrFloor = core.calculateAtr(rows, 14);
      if (atrFloor < core.minAtrDollars) return '15m ATR $' + atrFloor.toFixed(2) + ' is under the $2.50 gold floor';
      var sessNow = core.getInstitutionalSession(when);
      if (sessNow.isIbWindow) return 'Initial Balance is still forming (07:00-07:30 or 13:30-14:00 UTC)';
      if (!sessNow.isApex) return 'Outside the apex window (07:30-08:45 or 14:00-15:15 UTC)';
      var adr = core.calculateAdrExhaustion(rows);
      var pxBars = barsOf(rows);
      var pxNow = pxBars.length ? pxBars[pxBars.length - 1].close : 0;
      if (!adr.unread && adr.exhausted && String(sessNow.sessionName).indexOf('NY') === 0){
        if (want === 'BULL' && adr.position >= 0.75) return 'ADR ' + adr.pctUsed + '% used at the high: no New York continuation long';
        if (want === 'BEAR' && adr.position <= 0.25) return 'ADR ' + adr.pctUsed + '% used at the low: no New York continuation short';
      }
      var deal = core.calculateDealingRange(rows, pxNow);
      if (!deal.unread && want === 'BULL' && deal.percentile > 0.50) return 'Premium dealing range (' + Math.round(deal.percentile * 100) + '%): do not buy expensive gold';
      if (!deal.unread && want === 'BEAR' && deal.percentile < 0.50) return 'Discount dealing range (' + Math.round(deal.percentile * 100) + '%): do not sell cheap gold';
      var nymo = core.calculateTrueDayOpen(rows);
      if (!nymo.unread && nymo.nymo != null){
        if (want === 'BULL' && pxNow > nymo.nymo) return 'Above the New York midnight open ($' + nymo.nymo.toFixed(2) + '): the daily long is late';
        if (want === 'BEAR' && pxNow < nymo.nymo) return 'Below the New York midnight open ($' + nymo.nymo.toFixed(2) + '): the daily short is late';
      }
      var kin = core.calculateKineticEnergy(rows, atrFloor);
      if (want === 'BULL' && kin.downCascade) return 'Arrival is still a waterfall (score ' + kin.velocityScore + '): do not catch the knife';
      if (want === 'BEAR' && kin.upCascade) return 'Arrival is still a rip (score ' + kin.velocityScore + '): do not catch the knife';
      var poc = core.detectPocMigration(rows);
      if (!poc.unread && want === 'BULL' && poc.trappedSide === 'TRAPPED_LONGS') return 'Developing POC migrated up and price is back under it: longs are trapped';
      if (!poc.unread && want === 'BEAR' && poc.trappedSide === 'TRAPPED_SHORTS') return 'Developing POC migrated down and price is back over it: shorts are trapped';
      var cvd = core.calculateCvdAbsorption(rows, want);
      if (!cvd.unread && !cvd.confirmed) return 'Estimated delta does not confirm the ' + want + '. This is candle location, not the exchange tape';
      if (root.HG_PineGoldEngine){
        try {
          var fresh = new root.HG_PineGoldEngine().detectFreshFvgs(rows, 2.5) || [];
          var dead = fresh.filter(function(f){
            return f.state === 'EXHAUSTED' && pxNow >= f.bottom && pxNow <= f.top && ((want === 'BULL' && f.type === 'BULLISH_FVG') || (want === 'BEAR' && f.type === 'BEARISH_FVG'));
          });
          if (dead.length) return 'FVG exhausted past its 50% consequent encroachment';
        } catch (eCe) {}
      }
      var lastPx = barsOf(rows);
      lastPx = lastPx.length ? lastPx[lastPx.length - 1].close : 0;
      var regime = core.classifyAsianRegime(rows, lastPx);
      if (regime.regime === 'EXPANSION_TREND'){
        if (regime.drift !== 'UP' && want === 'BULL') return 'Asian expansion ' + regime.rangePct + '% down: do not fade the low';
        if (regime.drift !== 'DOWN' && want === 'BEAR') return 'Asian expansion ' + regime.rangePct + '% up: do not fade the high';
      }
      var smt = core.evaluateTripleSmt(rows, opts.silverRows || root.__hgSilverRows);
      if (!smt.unread && want === 'BULL' && smt.tripleSmtBearish) return 'Silver confirmed the high: bearish SMT';
      if (!smt.unread && want === 'BEAR' && smt.tripleSmtBullish) return 'Silver refused the low: bullish SMT';
    }
    return null;
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/&/g, '&' + 'amp;').replace(/</g, '&' + 'lt;').replace(/>/g, '&' + 'gt;');
  }

  function hgGoldInstReport(rows, macro){
    var core = new GoldCoreEngine();
    var when = lastDate(rows);
    var session = when ? core.getCurrentSession(when) : 'UNREAD';
    var veto = when ? core.checkTimeVeto(when) : { veto: false, reason: 'no bar time' };
    var view = macroView(macro);
    var closed = barsOf(rows);
    var px = closed.length ? closed[closed.length - 1].close : 0;
    var asia = core.calculateAsianRange(rows);
    var sw = sweepState(rows);
    var atr = core.calculateAtr(rows, 14);
    var regime = core.classifyAsianRegime(rows, px);
    var apex = when ? core.getInstitutionalSession(when) : null;
    var dealing = core.calculateDealingRange(rows, px, rows.length >= 144 ? 144 : 89);
    var ib = core.calculateInitialBalance(rows);
    var nymo = core.calculateTrueDayOpen(rows);
    var kinetic = core.calculateKineticEnergy(rows, atr);
    var poc = core.detectPocMigration(rows);
    var adr = core.calculateAdrExhaustion(rows);
    var cvd = core.calculateCvdAbsorption(rows, 'BULL');
    var gann = core.calculateGannSquare9(nymo && !nymo.unread ? nymo.nymo : px, px);
    var vi = core.detectVolumeImbalance(rows);
    var smt = core.evaluateTripleSmt(rows, root.__hgSilverRows);
    var breaker = core.detectBreakerBlock(rows);
    var bprs = [], va = null;
    try{
      if (root.HG_PineGoldEngine){
        var pine = new root.HG_PineGoldEngine();
        if (pine.detectBalancedPriceRanges) bprs = pine.detectBalancedPriceRanges(rows, 2) || [];
        if (pine.calculateValueArea) va = pine.calculateValueArea(rows);
      }
    }catch(eRep){}
    return { session: session, veto: veto, view: view, asia: asia, sweep: sw, atr: atr, when: when, regime: regime, apex: apex, smt: smt, breaker: breaker, bprs: bprs, valueArea: va, dealing: dealing, ib: ib, nymo: nymo, kinetic: kinetic, poc: poc, adr: adr, cvd: cvd, gann: gann, vi: vi };
  }

  function hgGoldInstStrip(report, judas){
    if (!report) return '';
    var asia = report.asia ? ('$' + report.asia.asl.toFixed(2) + ' - $' + report.asia.ash.toFixed(2) + ' ($' + report.asia.rangeDollars.toFixed(2) + ')') : 'unread';
    var judasLine = 'no Asian-extreme reclaim on this bar';
    if (judas && judas.active && judas.setup){
      var s = judas.setup;
      judasLine = s.direction + ' ' + (s.model || s.type || '') + ' entry $' + s.entryPrice + ' SL $' + s.stopLoss + ' TP $' + s.target;
      if (s.tripleSmtConfirmed) judasLine += ' · silver SMT';
      if (s.breakerConfirmed) judasLine += ' · breaker';
      if (s.trailingBreakevenStop != null) judasLine += ' · BE after TP1 $' + s.trailingBreakevenStop;
    } else if (judas && judas.reason) judasLine = judas.reason;
    var rg = report.regime || {};
    var sm = report.smt || {};
    var va = report.valueArea;
    var bpr = (report.bprs && report.bprs.length) ? (report.bprs.length + ' BPR') : 'no BPR';
    var smtTxt = sm.unread ? 'silver unread' : (sm.tripleSmtBullish ? 'bullish SMT' : (sm.tripleSmtBearish ? 'bearish SMT' : 'no SMT'));
    return '<div class="panel" data-hg-gold-inst="1" style="margin-top:8px"><h3>INSTITUTIONAL <span>apex, Asian regime, silver SMT, BPR</span></h3>'
      + '<div class="note">Session <b>' + esc(report.apex ? report.apex.sessionName : report.session) + '</b>'
      + (report.apex && report.apex.isApex ? ' APEX' : '')
      + ' · ' + (report.veto && report.veto.veto ? ('<b>SPREAD VETO</b> ' + esc(report.veto.reason)) : 'spread clean')
      + ' · NYMO ' + (report.nymo && !report.nymo.unread && fin(report.nymo.nymo) ? ('$' + report.nymo.nymo.toFixed(2)) : 'unread') + ' · ADR ' + (report.adr && !report.adr.unread ? (report.adr.pctUsed + '% of $' + report.adr.adrDollars) : 'unread') + ' · delta ' + (report.cvd && report.cvd.unread ? 'unread' : (report.cvd && report.cvd.deltaDivergence ? 'absorption' : 'no divergence')) + ' · Gann ' + (report.gann && !report.gann.unread ? ('$' + report.gann.closestLevel + ' ' + report.gann.distanceToGann + ' away') : 'unread') + (report.vi ? (' · ' + report.vi.type + ' $' + report.vi.gapSize) : '') + ' · kinetic ' + (report.kinetic ? report.kinetic.velocityScore : '—') + (report.poc && report.poc.trappedSide && report.poc.trappedSide !== 'NONE' ? (' · ' + report.poc.trappedSide) : '') + ' · range ' + esc((report.dealing && report.dealing.zone) || 'UNREAD') + (report.dealing && fin(report.dealing.percentile) ? (' ' + Math.round(report.dealing.percentile * 100) + '%') : '') + (report.apex && report.apex.isIbWindow ? ' · IB FORMING' : '') + ' · Asia ' + esc(rg.regime || 'UNKNOWN') + (fin(rg.rangePct) ? (' ' + rg.rangePct + '% ' + (rg.drift || '')) : '')
      + ' · ' + esc(smtTxt)
      + ' · ' + esc(bpr)
      + (va && fin(va.poc) ? (' · POC $' + va.poc + ' VAH $' + va.vah + ' VAL $' + va.val) : '')
      + ' · DXY ' + esc(report.view.dxyRaw)
      + ' · ATR $' + (fin(report.atr) ? report.atr.toFixed(2) : '—')
      + ' · box ' + esc(asia)
      + '<br>Judas: ' + esc(judasLine) + '</div></div>';
  }

  function hgGoldInstApply(list, rows, macro, opts){
    opts = opts || {};
    var demoted = 0, lead = '';
    var report = hgGoldInstReport(rows, macro);
    var judas = null;
    try{
      if (root.HG_GoldScalpEngine && String(opts.horizon || opts.desk || '').toLowerCase().indexOf('swing') < 0){
        judas = new root.HG_GoldScalpEngine().evaluateScalp(rows, rows, macroView(macro), opts.silverRows || root.__hgSilverRows);
      }
    }catch(eJ){ judas = null; }
    if (list && list.length){
      for (var i = 0; i < list.length; i++){
        var c = list[i];
        if (!c || c.demoted || c.vetoed) continue;
        var why = hgGoldInstBlocks(c.dir, rows, macro, Object.assign({ silverRows: opts.silverRows || root.__hgSilverRows }, opts));
        if (!why){
          if (judas && judas.active && judas.setup && side(c.dir) === judas.setup.direction){
            if (!c.stamps) c.stamps = [];
            if (c.stamps.indexOf('JUDAS RECLAIM') < 0) c.stamps.push('JUDAS RECLAIM');
          }
          continue;
        }
        c.demoted = true;
        c.instBlock = why;
        c.demotedWhy = why;
        if (!c.stamps) c.stamps = [];
        if (c.stamps.indexOf('INSTITUTIONAL') < 0) c.stamps.push('INSTITUTIONAL');
        demoted++;
        if (!lead) lead = why;
      }
    }
    try {
      if (judas && judas.active && judas.setup && typeof root.HG_quantEmit === 'function'){
        root.HG_quantEmit(Object.assign({ status: 'ARMED', symbol: 'XAUUSD', timeframe: '15m', gatesPassed: 7, totalGates: 7 }, judas.setup));
      }
    } catch (eEmit) {}
    return { demoted: demoted, lead: lead, html: hgGoldInstStrip(report, judas), judas: judas, report: report };
  }

  root.HG_GoldSessions = GoldSessions;
  root.HG_GoldCoreEngine = GoldCoreEngine;
  root.hgGoldBars = barsOf;
  root.hgGoldMacroView = macroView;
  root.hgGoldInstBlocks = hgGoldInstBlocks;
  root.hgGoldInstReport = hgGoldInstReport;
  root.hgGoldInstStrip = hgGoldInstStrip;
  root.hgGoldInstApply = hgGoldInstApply;
})(typeof globalThis !== 'undefined' ? globalThis : this);
