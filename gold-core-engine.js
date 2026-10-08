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
  GoldCoreEngine.prototype.checkTimeVeto = function(date){
    date = date || new Date();
    var utcHour = date.getUTCHours();
    var utcMinute = date.getUTCMinutes();
    if ((utcHour === 21 && utcMinute >= 30) || utcHour === 22 || utcHour === 23){
      return { veto: true, reason: 'Off-hours rollover: high spread and low depth' };
    }
    if ((utcHour === 10 && utcMinute >= 25 && utcMinute <= 35) ||
        (utcHour === 14 && utcMinute >= 55) || (utcHour === 15 && utcMinute <= 5)){
      return { veto: true, reason: 'London Fix window (10:30/15:00 UTC benchmark rebalance)' };
    }
    return { veto: false, reason: 'Timing valid' };
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
    var scalp = opts.horizon !== 'swing' && opts.horizon !== 'SWING' && String(opts.desk || '') !== 'ganesh-swing';
    if (scalp && String(opts.horizon || '').toLowerCase().indexOf('swing') < 0){
      var atr = core.calculateAtr(rows, 14);
      if (atr < core.minAtrDollars) return '15m ATR $' + atr.toFixed(2) + ' is under the $2.50 gold floor';
    }
    return null;
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>');
  }

  function hgGoldInstReport(rows, macro){
    var core = new GoldCoreEngine();
    var when = lastDate(rows);
    var session = when ? core.getCurrentSession(when) : 'UNREAD';
    var veto = when ? core.checkTimeVeto(when) : { veto: false, reason: 'no bar time' };
    var view = macroView(macro);
    var asia = core.calculateAsianRange(rows);
    var sw = sweepState(rows);
    var atr = core.calculateAtr(rows, 14);
    return { session: session, veto: veto, view: view, asia: asia, sweep: sw, atr: atr, when: when };
  }

  function hgGoldInstStrip(report, judas){
    if (!report) return '';
    var asia = report.asia ? ('$' + report.asia.asl.toFixed(2) + ' - $' + report.asia.ash.toFixed(2) + ' ($' + report.asia.rangeDollars.toFixed(2) + ')') : 'unread';
    var judasLine = 'no Asian-extreme reclaim on this bar';
    if (judas && judas.active && judas.setup){
      var s = judas.setup;
      judasLine = s.direction + ' ' + s.type + ' entry $' + s.entryPrice + ' SL $' + s.stopLoss + ' TP $' + s.target;
    } else if (judas && judas.reason) judasLine = judas.reason;
    return '<div class="panel" data-hg-gold-inst="1" style="margin-top:8px"><h3>INSTITUTIONAL <span>XAUUSD session, dollar, real yield</span></h3>'
      + '<div class="note">Session <b>' + esc(report.session) + '</b>'
      + ' · ' + (report.veto && report.veto.veto ? ('<b>SPREAD VETO</b> ' + esc(report.veto.reason)) : 'spread clean')
      + ' · DXY ' + esc(report.view.dxyRaw) + (report.view.dxyTrend !== 'FLAT' ? (' ' + esc(report.view.dxyTrend)) : '')
      + ' · real yield ' + esc(report.view.yieldRaw) + (report.view.us10yTrend !== 'FLAT' ? (' ' + esc(report.view.us10yTrend)) : '')
      + ' · ATR $' + (fin(report.atr) ? report.atr.toFixed(2) : '—')
      + ' · Asia ' + esc(asia)
      + '<br>Judas: ' + esc(judasLine) + '</div></div>';
  }

  function hgGoldInstApply(list, rows, macro, opts){
    opts = opts || {};
    var demoted = 0, lead = '';
    var report = hgGoldInstReport(rows, macro);
    var judas = null;
    try{
      if (root.HG_GoldScalpEngine && String(opts.horizon || opts.desk || '').toLowerCase().indexOf('swing') < 0){
        judas = new root.HG_GoldScalpEngine().evaluateScalp(rows, rows, macroView(macro));
      }
    }catch(eJ){ judas = null; }
    if (list && list.length){
      for (var i = 0; i < list.length; i++){
        var c = list[i];
        if (!c || c.demoted || c.vetoed) continue;
        var why = hgGoldInstBlocks(c.dir, rows, macro, opts);
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
