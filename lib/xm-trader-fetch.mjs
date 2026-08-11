/* HARDGATE — XM / MT5 gold candle fetch (server-side bridge proxy).
   XM has no public market-data API; wire an MT5 REST bridge via env:
     XM_MT5_URL=https://your-mt5-bridge:8000
     XM_MT5_TOKEN=optional-bearer
     XM_GOLD_SYMBOL=XAUUSD   (or GOLD on some XM accounts)
   Supports mt5-bridge (/rates/{sym}) and mt5-rest-api (/candles/{sym}) shapes. */

const TTL_MS = 45 * 1000;
const UPSTREAM_TIMEOUT_MS = 20000;

const TF_MT5 = {
  '15m': 'M15',
  '1h': 'H1',
  '4h': 'H4',
  '1d': 'D1',
};

const __cache = new Map();
const __inflight = new Map();

function sleep(ms){
  return new Promise(function(resolve){ setTimeout(resolve, ms); });
}

function trimSlash(s){
  return String(s || '').replace(/\/+$/, '');
}

export function xmTraderConfig(){
  var base = trimSlash(process.env.XM_MT5_URL || process.env.XM_TRADERS_URL || '');
  var token = process.env.XM_MT5_TOKEN || process.env.XM_TRADERS_TOKEN || '';
  var symbol = (process.env.XM_GOLD_SYMBOL || process.env.XM_TRADERS_SYMBOL || 'XAUUSD').trim() || 'XAUUSD';
  var style = (process.env.XM_MT5_STYLE || 'auto').toLowerCase();
  return { base, token, symbol, style, configured: !!base };
}

export function xmTraderStatus(){
  var cfg = xmTraderConfig();
  return {
    ok: true,
    configured: cfg.configured,
    symbol: cfg.symbol,
    style: cfg.style,
    routes: ['/api/xm/status', '/api/xm/candles', '/api/xm/tick'],
    ttlSec: TTL_MS / 1000,
  };
}

function authHeaders(token){
  var h = { Accept: 'application/json', 'User-Agent': 'HARDGATE/1.0 (+https://hardgate-main.onrender.com)' };
  if (token){
    h.Authorization = 'Bearer ' + token;
    h['X-API-Token'] = token;
  }
  return h;
}

function num(v){
  var n = +v;
  return isFinite(n) ? n : NaN;
}

function normBar(raw){
  if (!raw || typeof raw !== 'object') return null;
  var t = num(raw.t != null ? raw.t : (raw.time != null ? raw.time : raw.time_msc));
  if (isFinite(t) && t > 1e12) t = Math.floor(t / 1000);
  if (!isFinite(t) && raw.datetime){
    t = Math.floor(Date.parse(String(raw.datetime).replace(' ', 'T') + 'Z') / 1000);
  }
  var o = num(raw.o != null ? raw.o : raw.open);
  var h = num(raw.h != null ? raw.h : raw.high);
  var l = num(raw.l != null ? raw.l : raw.low);
  var c = num(raw.c != null ? raw.c : raw.close);
  var v = num(raw.v != null ? raw.v : (raw.volume != null ? raw.volume : (raw.tick_volume != null ? raw.tick_volume : 0)));
  if (!isFinite(t) || !isFinite(o) || !isFinite(h) || !isFinite(l) || !isFinite(c)) return null;
  return { t: Math.floor(t), o: o, h: h, l: l, c: c, v: isFinite(v) ? v : 0 };
}

export function xmNormBars(payload){
  if (!payload) return [];
  var list = null;
  if (Array.isArray(payload)) list = payload;
  else if (Array.isArray(payload.rates)) list = payload.rates;
  else if (Array.isArray(payload.candles)) list = payload.candles;
  else if (Array.isArray(payload.data)) list = payload.data;
  else if (payload.data && Array.isArray(payload.data.rates)) list = payload.data.rates;
  else if (payload.data && Array.isArray(payload.data.candles)) list = payload.data.candles;
  if (!list) return [];
  var out = [];
  for (var i = 0; i < list.length; i++){
    var b = normBar(list[i]);
    if (b) out.push(b);
  }
  out.sort(function(a, b){ return a.t - b.t; });
  return out;
}

function buildUrls(base, symbol, mt5Tf, count){
  var enc = encodeURIComponent(symbol);
  var q = '?timeframe=' + encodeURIComponent(mt5Tf) + '&count=' + Math.min(5000, Math.max(10, count));
  return [
    base + '/rates/' + enc + q,
    base + '/candles/' + enc + q,
    base + '/api/rates/' + enc + q,
    base + '/api/candles/' + enc + q,
    base + '/api/accounts/1/bars/' + enc + q,
  ];
}

async function upstreamGet(url, token){
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, UPSTREAM_TIMEOUT_MS);
  try{
    var res = await fetch(url, { method: 'GET', signal: ctrl.signal, headers: authHeaders(token) });
    clearTimeout(timer);
    var text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, text: text, reason: 'HTTP ' + res.status };
    var body = null;
    try{ body = JSON.parse(text); }catch(e){ return { ok: false, status: 502, reason: 'invalid json from MT5 bridge' }; }
    return { ok: true, status: 200, body: body };
  }catch(e){
    clearTimeout(timer);
    return { ok: false, status: 0, reason: (e && e.message) || 'fetch error' };
  }
}

async function fetchBarsFromBridge(cfg, tf, count){
  var mt5Tf = TF_MT5[tf];
  if (!mt5Tf) return { ok: false, reason: 'unsupported tf: ' + tf };
  if (!cfg.base) return { ok: false, reason: 'xm_not_configured' };

  var symbols = [cfg.symbol];
  if (cfg.symbol.toUpperCase() === 'XAUUSD') symbols.push('GOLD');
  if (cfg.symbol.toUpperCase() === 'GOLD') symbols.push('XAUUSD');

  var lastFail = { ok: false, reason: 'xm_bridge_unreachable' };
  for (var si = 0; si < symbols.length; si++){
    var sym = symbols[si];
    var urls = buildUrls(cfg.base, sym, mt5Tf, count);
    for (var ui = 0; ui < urls.length; ui++){
      var up = await upstreamGet(urls[ui], cfg.token);
      if (!up.ok){
        lastFail = { ok: false, reason: up.reason || 'upstream failed', status: up.status };
        continue;
      }
      var rows = xmNormBars(up.body);
      if (rows.length >= Math.min(10, count)){
        return { ok: true, rows: rows.slice(-count), symbol: sym, url: urls[ui] };
      }
    }
  }
  return lastFail;
}

export async function xmFetchGoldCandles(tf, count){
  tf = tf || '15m';
  count = Math.max(10, Math.min(5000, +(count || 200)));
  var cfg = xmTraderConfig();
  var key = 'xm|' + cfg.base + '|' + cfg.symbol + '|' + tf + '|' + count;
  var hit = __cache.get(key);
  if (hit && (Date.now() - hit.at) < TTL_MS) return hit.payload;

  if (__inflight.has(key)) return __inflight.get(key);

  var p = (async function(){
    var out = await fetchBarsFromBridge(cfg, tf, count);
    if (out.ok){
      var payload = { ok: true, rows: out.rows, source: 'xm-xauusd', symbol: out.symbol };
      __cache.set(key, { at: Date.now(), payload: payload });
      return payload;
    }
    return { ok: false, rows: [], source: null, reason: out.reason || 'xm_fetch_failed' };
  })();

  __inflight.set(key, p);
  try{ return await p; }
  finally{ __inflight.delete(key); }
}

export async function xmFetchGoldTick(){
  var cfg = xmTraderConfig();
  if (!cfg.base) return { ok: false, reason: 'xm_not_configured' };
  var symbols = [cfg.symbol];
  if (cfg.symbol.toUpperCase() === 'XAUUSD') symbols.push('GOLD');
  for (var i = 0; i < symbols.length; i++){
    var sym = encodeURIComponent(symbols[i]);
    var urls = [
      cfg.base + '/tick/' + sym,
      cfg.base + '/api/tick/' + sym,
      cfg.base + '/symbols/' + sym,
      cfg.base + '/api/symbols/' + sym,
    ];
    for (var u = 0; u < urls.length; u++){
      var up = await upstreamGet(urls[u], cfg.token);
      if (!up.ok) continue;
      var body = up.body;
      var bid = num(body && (body.bid != null ? body.bid : (body.data && body.data.bid)));
      var ask = num(body && (body.ask != null ? body.ask : (body.data && body.data.ask)));
      var last = num(body && (body.last != null ? body.last : (body.price != null ? body.price : (body.data && body.data.last))));
      if (isFinite(bid) || isFinite(ask) || isFinite(last)){
        return { ok: true, symbol: symbols[i], bid: bid, ask: ask, last: last, source: 'xm-xauusd' };
      }
    }
  }
  return { ok: false, reason: 'xm_tick_unavailable' };
}
