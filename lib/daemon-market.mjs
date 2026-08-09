/* Fetch last closed OHLCV bars for conviction invalidation (public Binance). */
import { unwindConvictionOnExchange } from './daemon-unwind.mjs';

export function convictionRealizedR(setup, status, candle){
  try{
    if (!setup || !setup.levels) return null;
    var entry = +setup.levels.entry;
    var stop = +setup.levels.stopLoss;
    var tp1 = +setup.levels.tp1;
    var dir = setup.direction || setup.dir;
    if (!isFinite(entry) || !isFinite(stop)) return null;
    var risk = Math.abs(entry - stop);
    if (!(risk > 0)) return null;
    var sign = (String(dir || '').toLowerCase() === 'short') ? -1 : 1;
    var st = String(status || '').toUpperCase().replace(/_/g, ' ');
    if (st === 'STOPPED' || st === 'INVALIDATED') return -1;
    if (st === 'TARGET HIT'){
      if (isFinite(tp1)) return sign * (tp1 - entry) / risk;
      return 2;
    }
    var px = candle && (isFinite(candle.c) ? +candle.c : (isFinite(candle.close) ? +candle.close : NaN));
    if (st === 'EXPIRED' || st === 'MOMENTUM DECAY' || st === 'TIME STOP'){
      if (!isFinite(px)) return null;
      return sign * (px - entry) / risk;
    }
    return null;
  }catch(e){ return null; }
}

export function symToBinanceKlineSymbol(sym){
  try{
    var s = String(sym || '').trim();
    var m = /^B-([A-Z0-9]+)_USDT$/i.exec(s);
    if (m) return m[1] + 'USDT';
    if (/USDT$/i.test(s)) return s.toUpperCase();
    if (/USD$/i.test(s) && !/USDT$/i.test(s)) return s.replace(/USD$/i, '') + 'USDT';
    return s.toUpperCase();
  }catch(e){ return sym; }
}

export function is15mBarClose(bar){
  try{
    var t = bar && (bar.t != null ? bar.t : bar.timestamp);
    if (!isFinite(t)) return false;
    var ms = (t < 1e12) ? t * 1000 : t;
    var d = new Date(ms);
    return d.getUTCMinutes() % 15 === 0;
  }catch(e){ return false; }
}

function parseKlineRow(k){
  return {
    t: Math.floor(+k[0] / 1000),
    o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5],
  };
}

export async function fetchLastClosedBar(sym, interval){
  interval = interval || '15m';
  var symbol = symToBinanceKlineSymbol(sym);
  if (!symbol) return null;
  var urls = [
    'https://fapi.binance.com/fapi/v1/klines?symbol=' + encodeURIComponent(symbol) + '&interval=' + interval + '&limit=3',
    'https://api.binance.com/api/v3/klines?symbol=' + encodeURIComponent(symbol) + '&interval=' + interval + '&limit=3',
  ];
  for (var i = 0; i < urls.length; i++){
    try{
      var res = await fetch(urls[i], { signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      var rows = await res.json();
      if (!Array.isArray(rows) || rows.length < 2) continue;
      return parseKlineRow(rows[rows.length - 2]);
    }catch(e){ /* try next */ }
  }
  return null;
}

export async function evaluateActiveConvictions(ctx){
  ctx = ctx || {};
  var mgr = ctx.convictionManager;
  var db = ctx.db;
  var log = ctx.log || function(){};
  if (!mgr || !mgr.activeConvictions) return { closed: 0 };
  var now = Date.now();
  var closed = 0;
  var ids = Array.from(mgr.activeConvictions.keys());
  var skip = ctx.excludeIds instanceof Set ? ctx.excludeIds
    : new Set(Array.isArray(ctx.excludeIds) ? ctx.excludeIds : []);
  for (var i = 0; i < ids.length; i++){
    var id = ids[i];
    if (skip.has(id)) continue;
    var setup = mgr.activeConvictions.get(id);
    if (!setup) continue;
    var candle = ctx.currentCandle;
    if (!candle && setup.sym){
      candle = await fetchLastClosedBar(setup.sym, setup.type === 'swing' ? '4h' : '15m');
    }
    if (!candle) continue;
    var is15 = is15mBarClose(candle);
    var status = mgr.evaluateSetup(setup, candle, is15, false, now, ctx.barIndex);
    if (status){
      setup.status = status;
      await unwindConvictionOnExchange(setup, status, ctx.executor, {
        dryRun: ctx.dryRun,
        log: log,
      });
      mgr.activeConvictions.delete(id);
      if (db){
        var rOut = convictionRealizedR(setup, status, candle);
        if (rOut != null && isFinite(rOut) && typeof db.recordOutcome === 'function'){
          db.recordOutcome({
            sym: setup.sym,
            r: rOut,
            closedAt: Date.now(),
            reason: status,
            fpKey: setup.fpKey || null,
            side: setup.dir || setup.direction || null,
          });
        }
        db.removeConviction(id);
      }
      closed++;
      log('[LOCK CLOSED] ' + id + ' — ' + status);
    }else if (db && mgr.toRecord){
      var rec = mgr.toRecord(setup);
      if (rec) db.saveConviction(rec.id, rec);
    }
  }
  return { closed: closed };
}
