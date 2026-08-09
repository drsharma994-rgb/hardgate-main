/* HARDGATE — server-side Delta + CoinDCX universe (mirrors xuniverse.js). */
const DELTA = 'https://api.india.delta.exchange';
const CDCX_PUB = 'https://public.coindcx.com';
const CDCX_API = 'https://api.coindcx.com';
const DELTA_RES = { '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d' };
const CDCX_RES = { '15m': '15', '1h': '60', '4h': '240', '1d': '1D' };
const SEC_PER = { '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

function numOrNull(x){
  var n = parseFloat(x);
  return isFinite(n) ? n : null;
}

function baseOf(sym, exchange){
  var s = String(sym == null ? '' : sym).toUpperCase();
  if (exchange === 'coindcx') return s.replace(/^B-/, '').replace(/_USDT$/, '');
  return s.replace(/USD(T)?$/, '');
}

async function fetchJson(url, timeoutMs){
  timeoutMs = timeoutMs || 12000;
  var ctrl = new AbortController();
  var t = setTimeout(function(){ ctrl.abort(); }, timeoutMs);
  try{
    var res = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  }catch(e){
    return null;
  }finally{
    clearTimeout(t);
  }
}

export function normDeltaRows(raw){
  var arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.result) ? raw.result : []);
  var out = [];
  for (var i = 0; i < arr.length; i++){
    var t = arr[i];
    if (!t || !t.symbol) continue;
    var sym = String(t.symbol);
    out.push({
      sym: sym,
      base: baseOf(sym, 'delta'),
      exchange: 'delta',
      turnoverUsd: numOrNull(t.turnover_usd != null ? t.turnover_usd : t.turnover),
      mark: numOrNull(t.mark_price != null ? t.mark_price : t.close),
      fundingPct: t.funding_rate != null ? numOrNull(t.funding_rate) : null,
    });
  }
  return out;
}

export function normCdcxRows(raw){
  var list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.instruments) ? raw.instruments : []);
  var out = [];
  for (var i = 0; i < list.length; i++){
    var s = list[i];
    var sym = typeof s === 'string' ? s : (s && s.symbol);
    if (!sym) continue;
    sym = String(sym);
    out.push({
      sym: sym,
      base: baseOf(sym, 'coindcx'),
      exchange: 'coindcx',
      turnoverUsd: null,
      mark: null,
      fundingPct: null,
    });
  }
  return out;
}

export function mergeCdcxMarks(rows, body){
  var src = (body && body.prices) ? body.prices : (body && typeof body === 'object' ? body : {});
  var out = [];
  var count = 0;
  for (var i = 0; i < (rows || []).length; i++){
    var r = rows[i];
    var p = r && r.sym ? src[r.sym] : null;
    var mark = null;
    var to = null;
    if (p && typeof p === 'object'){
      mark = numOrNull(p.mp != null ? p.mp : p.ls);
      to = numOrNull(p.v);
    } else if (p != null){
      mark = numOrNull(p);
    }
    var o = Object.assign({}, r);
    if (mark != null) o.mark = mark;
    if (to != null) o.turnoverUsd = to;
    if (mark != null || to != null) count++;
    out.push(o);
  }
  return { rows: out, count: count };
}

export async function fetchDualUniverse(){
  var deltaRaw = await fetchJson(DELTA + '/v2/tickers?contract_types=perpetual_futures');
  var cdcxRaw = await fetchJson(CDCX_API + '/exchange/v1/derivatives/futures/data/active_instruments?margin_currency_short_name[]=USDT');
  var marksRaw = await fetchJson(CDCX_PUB + '/market_data/v3/current_prices/futures/rt');
  var delta = normDeltaRows(deltaRaw);
  var cdcx = normCdcxRows(cdcxRaw);
  var merged = mergeCdcxMarks(cdcx, marksRaw);
  return {
    delta: delta,
    coindcx: merged.rows,
    cdcxMarks: merged.count,
    note: (!delta.length && !merged.rows.length) ? 'both venue legs failed' : null,
  };
}

function sanitizeRows(rows){
  if (!rows || !rows.length) return [];
  var out = [];
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    if (!r) continue;
    var t = +(r.t != null ? r.t : r.time);
    var o = +(r.o != null ? r.o : r.open);
    var h = +(r.h != null ? r.h : r.high);
    var l = +(r.l != null ? r.l : r.low);
    var c = +(r.c != null ? r.c : r.close);
    var v = +(r.v != null ? r.v : r.volume);
    if (!isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) continue;
    if (t > 1e12) t = Math.floor(t / 1000);
    out.push({ t: t, o: o, h: h, l: l, c: c, v: isFinite(v) ? v : 0 });
  }
  out.sort(function(a, b){ return a.t - b.t; });
  return out;
}

function dropForming(rows, tf){
  var sec = SEC_PER[tf] || 0;
  if (!sec || !rows.length) return rows;
  var lastT = rows[rows.length - 1].t;
  return ((Date.now() / 1000) - lastT < sec) ? rows.slice(0, -1) : rows;
}

export async function fetchVenueCandles(item, tf, count){
  count = count || 260;
  var now = Math.floor(Date.now() / 1000);
  var sec = SEC_PER[tf] || 14400;
  var start = now - count * sec;
  var rows = null;
  if (item.exchange === 'delta'){
    var res = DELTA_RES[tf] || '4h';
    var j = await fetchJson(DELTA + '/v2/history/candles?resolution=' + encodeURIComponent(res)
      + '&symbol=' + encodeURIComponent(item.sym) + '&start=' + start + '&end=' + now);
    if (j && Array.isArray(j.result)){
      rows = j.result.map(function(b){
        return { t: +b.time, o: +b.open, h: +b.high, l: +b.low, c: +b.close, v: +b.volume };
      });
    }
  } else if (item.exchange === 'coindcx'){
    var cres = CDCX_RES[tf] || '240';
    var from = (now - count * sec) * 1000;
    var to = now * 1000;
    var cj = await fetchJson(CDCX_PUB + '/market_data/candlesticks?pair=' + encodeURIComponent(item.sym)
      + '&from=' + from + '&to=' + to + '&resolution=' + cres + '&pcode=f');
    if (cj && Array.isArray(cj.data)){
      rows = cj.data.map(function(b){
        return { t: Math.floor(+b.time / 1000), o: +b.open, h: +b.high, l: +b.low, c: +b.close, v: +b.volume };
      });
    }
  }
  var clean = sanitizeRows(rows);
  return dropForming(clean, tf);
}

export function topByTurnover(items, venue, n){
  return (items || [])
    .filter(function(it){ return it && it.exchange === venue; })
    .sort(function(a, b){ return (b.turnoverUsd || 0) - (a.turnoverUsd || 0); })
    .slice(0, n);
}
