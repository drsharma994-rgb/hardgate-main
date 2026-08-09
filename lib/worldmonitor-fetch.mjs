/* HARDGATE — World Monitor desk fetch (remote API + local public-source fallback). */
import {
  wmApiBase,
  wmConfigured,
  wmFinalizeDesk,
} from './worldmonitor-core.mjs';

const HYPERLIQUID_URL = 'https://api.hyperliquid.xyz/info';
const HL_SYMBOLS = ['BTC', 'ETH', 'PAXG', 'xyz:GOLD'];

function sleep(ms){
  return new Promise(function(r){ setTimeout(r, ms); });
}

async function fetchJson(url, opts){
  opts = opts || {};
  var ctrl = new AbortController();
  var t = setTimeout(function(){ ctrl.abort(); }, opts.timeoutMs || 12000);
  try{
    var res = await fetch(url, {
      method: opts.method || 'GET',
      headers: opts.headers || { Accept: 'application/json' },
      body: opts.body,
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  }catch(e){
    return null;
  }finally{
    clearTimeout(t);
  }
}

async function fetchFredSeries(seriesId, env){
  var key = env.FRED_API_KEY;
  if (!key) return null;
  var url = 'https://api.stlouisfed.org/fred/series/observations?series_id='
    + encodeURIComponent(seriesId) + '&api_key=' + encodeURIComponent(key)
    + '&file_type=json&sort_order=desc&limit=30';
  var j = await fetchJson(url);
  if (!j || !Array.isArray(j.observations)) return null;
  var vals = j.observations.map(function(o){
    return o.value === '.' ? null : +o.value;
  }).filter(function(v){ return v != null && isFinite(v); });
  return vals.length ? vals : null;
}

function extractYahooCloses(chart){
  try{
    var r = chart.chart.result[0];
    var q = r.indicators.quote[0];
    return (q.close || []).filter(function(v){ return v != null && isFinite(v); });
  }catch(e){ return []; }
}

function roc(prices, days){
  if (prices.length < days + 1) return null;
  var cur = prices[prices.length - 1];
  var past = prices[prices.length - 1 - days];
  return past ? ((cur - past) / past) * 100 : null;
}

function sma(prices, n){
  if (prices.length < n) return null;
  var s = prices.slice(-n).reduce(function(a, b){ return a + b; }, 0);
  return s / n;
}

async function fetchLocalMacro(env){
  var fng = await fetchJson('https://api.alternative.me/fng/?limit=1&format=json');
  var fgVal = null;
  var fgLabel = 'UNKNOWN';
  if (fng && fng.data && fng.data[0]){
    fgVal = parseInt(fng.data[0].value, 10);
    fgLabel = fng.data[0].value_classification || fgLabel;
  }

  var yahooBase = 'https://query1.finance.yahoo.com/v8/finance/chart';
  var btcChart = await fetchJson(yahooBase + '/BTC-USD?range=1y&interval=1d');
  await sleep(120);
  var qqqChart = await fetchJson(yahooBase + '/QQQ?range=1y&interval=1d');
  await sleep(120);
  var xlpChart = await fetchJson(yahooBase + '/XLP?range=1y&interval=1d');

  var btc = extractYahooCloses(btcChart);
  var qqq = extractYahooCloses(qqqChart);
  var xlp = extractYahooCloses(xlpChart);

  var qqqRoc20 = roc(qqq, 20);
  var xlpRoc20 = roc(xlp, 20);
  var regime = (qqqRoc20 != null && xlpRoc20 != null)
    ? (qqqRoc20 > xlpRoc20 ? 'RISK-ON' : 'DEFENSIVE') : 'UNKNOWN';

  var btcRoc5 = roc(btc, 5);
  var qqqRoc5 = roc(qqq, 5);
  var flow = (btcRoc5 != null && qqqRoc5 != null)
    ? (Math.abs(btcRoc5 - qqqRoc5) > 5 ? 'PASSIVE GAP' : 'ALIGNED') : 'UNKNOWN';

  var btcCur = btc.length ? btc[btc.length - 1] : null;
  var btcSma50 = sma(btc, 50);
  var trend = 'UNKNOWN';
  if (btcCur && btcSma50){
    if (btcCur > btcSma50 * 1.02) trend = 'BULLISH';
    else if (btcCur < btcSma50 * 0.98) trend = 'BEARISH';
    else trend = 'NEUTRAL';
  }

  var signals = [
    { name: 'Macro Regime', status: regime, bullish: regime === 'RISK-ON' },
    { name: 'Flow Structure', status: flow, bullish: flow === 'ALIGNED' },
    { name: 'Technical Trend', status: trend, bullish: trend === 'BULLISH' },
    { name: 'Fear & Greed', status: fgLabel, bullish: fgVal != null && fgVal > 50 },
  ];
  var bullish = 0, total = 0;
  for (var i = 0; i < signals.length; i++){
    if (signals[i].status !== 'UNKNOWN'){ total++; if (signals[i].bullish) bullish++; }
  }
  var verdict = total === 0 ? 'UNKNOWN' : (bullish / total >= 0.57 ? 'BUY' : 'CASH');
  return {
    timestamp: new Date().toISOString(),
    verdict: verdict,
    bullishCount: bullish,
    totalCount: total,
    signals: signals,
    fearGreed: { value: fgVal, label: fgLabel },
    unavailable: total === 0,
  };
}

async function fetchLocalStress(env){
  var vix = await fetchFredSeries('VIXCLS', env);
  var curve = await fetchFredSeries('T10Y2Y', env);
  if (!vix && !curve) return null;
  var v = vix && vix.length ? vix[0] : null;
  var c = curve && curve.length ? curve[0] : null;
  var score = 0, parts = 0;
  if (v != null){ score += Math.min(100, Math.max(0, (v - 15) / 65 * 100)) * 0.5; parts++; }
  if (c != null){ score += Math.min(100, Math.max(0, (0.5 - c) / 2 * 100)) * 0.5; parts++; }
  if (!parts) return null;
  var s = score / parts;
  var label = s < 20 ? 'Low' : s < 40 ? 'Moderate' : s < 60 ? 'Elevated' : s < 80 ? 'Severe' : 'Critical';
  return { score: +s.toFixed(1), label: label, vix: v, t10y2y: c };
}

async function fetchLocalGold(env){
  var chart = await fetchJson('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=5d&interval=1d');
  var closes = extractYahooCloses(chart);
  if (!closes.length) return { unavailable: true };
  var cur = closes[closes.length - 1];
  var prev = closes.length > 1 ? closes[closes.length - 2] : cur;
  var chPct = prev ? ((cur - prev) / prev) * 100 : 0;
  return {
    unavailable: false,
    goldPrice: cur,
    goldChangePct: chPct,
    source: 'yahoo-gc=f',
  };
}

async function fetchLocalHyperliquid(){
  var raw = await fetchJson(HYPERLIQUID_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
  });
  if (!raw || !Array.isArray(raw) || raw.length < 2) return { assets: [] };
  var universe = raw[0] && raw[0].universe;
  var ctxs = raw[1];
  if (!Array.isArray(universe) || !Array.isArray(ctxs)) return { assets: [] };
  var byName = {};
  for (var i = 0; i < universe.length; i++){
    byName[universe[i].name] = ctxs[i] || {};
  }
  var assets = [];
  for (var si = 0; si < HL_SYMBOLS.length; si++){
    var sym = HL_SYMBOLS[si];
    var ctx = byName[sym];
    if (!ctx) continue;
    var funding = ctx.funding != null ? +ctx.funding : null;
    var oi = ctx.openInterest != null ? +ctx.openInterest : null;
    var vol = ctx.dayNtlVlm != null ? +ctx.dayNtlVlm : null;
    var mark = ctx.markPx != null ? +ctx.markPx : null;
    var score = 0;
    if (funding != null) score += Math.min(100, Math.abs(funding) / 0.001 * 30);
    if (vol != null && vol > 0) score += Math.min(40, vol / 1e8 * 10);
    assets.push({
      symbol: sym,
      display: sym.replace('xyz:', ''),
      fundingRate: funding,
      openInterest: oi,
      volume24h: vol,
      mark: mark,
      score: Math.round(Math.min(100, score)),
      alert: score >= 60,
    });
  }
  return { assets: assets, at: Date.now(), source: 'hyperliquid-public' };
}

async function fetchRemoteWorldMonitor(env){
  var base = wmApiBase(env);
  var key = env.WORLDMONITOR_API_KEY;
  var headers = {
    Accept: 'application/json',
    'X-WorldMonitor-Key': key,
  };
  var macro = await fetchJson(base + '/api/economic/v1/get-macro-signals', { headers: headers });
  var gold = await fetchJson(base + '/api/market/v1/get-gold-intelligence', { headers: headers });
  var hl = await fetchJson(base + '/api/market/v1/get-hyperliquid-flow', { headers: headers });
  if (!macro && !gold && !hl) return null;
  return wmFinalizeDesk({
    source: 'worldmonitor-api',
    macro: macro || { unavailable: true, verdict: 'UNKNOWN' },
    stress: null,
    gold: gold || { unavailable: true },
    hyperliquid: hl && hl.assets ? hl : { assets: hl && hl.alerts ? hl.alerts : [] },
  });
}

export async function fetchWorldMonitorDesk(env){
  env = env || process.env;
  if (wmConfigured(env)){
    try{
      var remote = await fetchRemoteWorldMonitor(env);
      if (remote && (remote.macro && !remote.macro.unavailable || remote.gold && !remote.gold.unavailable)){
        return remote;
      }
    }catch(e){ /* fall through to local */ }
  }

  var results = await Promise.allSettled([
    fetchLocalMacro(env),
    fetchLocalStress(env),
    fetchLocalGold(env),
    fetchLocalHyperliquid(),
  ]);
  return wmFinalizeDesk({
    source: 'hardgate-local',
    macro: results[0].status === 'fulfilled' ? results[0].value : { unavailable: true, verdict: 'UNKNOWN' },
    stress: results[1].status === 'fulfilled' ? results[1].value : null,
    gold: results[2].status === 'fulfilled' ? results[2].value : { unavailable: true },
    hyperliquid: results[3].status === 'fulfilled' ? results[3].value : { assets: [] },
  });
}

export function worldmonitorCapabilities(env){
  env = env || process.env;
  return {
    ok: true,
    configured: wmConfigured(env),
    apiBase: wmConfigured(env) ? wmApiBase(env) : null,
    deskRoute: '/api/worldmonitor/desk',
    localFallback: true,
    sources: ['alternative.me F&G', 'Yahoo chart (macro/gold)', 'FRED VIX/yield (optional)', 'Hyperliquid public'],
    attribution: 'https://github.com/koala73/worldmonitor',
  };
}
