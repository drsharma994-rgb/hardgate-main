/* HARDGATE — server-side OpenBB desk snapshot fetch (Yahoo + optional OpenBB API). */
import {
  obbParseYahooChart,
  obbTrend20,
  obbMergeOpenBBPayload,
  obbFinalizeDesk,
} from './openbb-desk-core.mjs';

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const TIMEOUT_MS = 12000;

async function fetchJson(url){
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, TIMEOUT_MS);
  try{
    var res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'HARDGATE/1.0' } });
    if (!res.ok) return null;
    return await res.json();
  }catch(e){ return null; }
  finally{ clearTimeout(timer); }
}

async function yahooSymbol(symbol, range){
  var enc = encodeURIComponent(symbol);
  var j = await fetchJson(YAHOO + enc + '?interval=1d&range=' + (range || '1mo'));
  var rows = obbParseYahooChart(j);
  return Object.assign({ symbol: symbol }, obbTrend20(rows));
}

async function fetchOpenBBBackend(route){
  var base = (process.env.OPENBB_API_URL || '').replace(/\/$/, '');
  if (!base) return null;
  var url = base + (route.startsWith('/') ? route : '/' + route);
  var headers = { Accept: 'application/json' };
  var user = process.env.OPENBB_API_USERNAME || '';
  var pass = process.env.OPENBB_API_PASSWORD || '';
  if (user && pass){
    headers.Authorization = 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');
  }
  var key = process.env.OPENBB_API_KEY || '';
  if (key) headers['X-API-KEY'] = key;
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, TIMEOUT_MS);
  try{
    var res = await fetch(url, { signal: ctrl.signal, headers: headers });
    if (!res.ok) return null;
    return await res.json();
  }catch(e){ return null; }
  finally{ clearTimeout(timer); }
}

/** Build desk snapshot from public Yahoo legs (+ optional OpenBB backend). */
export async function fetchDeskMacro(baseMacro){
  var desk = Object.assign({ source: 'yahoo-desk', at: Date.now() }, baseMacro || {});
  try{
    var legs = await Promise.all([
      yahooSymbol('SPY'),
      yahooSymbol('QQQ'),
      yahooSymbol('^VIX'),
      yahooSymbol('BTC-USD'),
    ]);
    desk.spx = desk.spy = legs[0];
    desk.qqq = legs[1];
    desk.vix = legs[2];
    desk.btc = legs[3];
  }catch(e){}

  var obbRoute = process.env.OPENBB_API_ROUTE || '/api/v1/economy/overview';
  var obbRaw = await fetchOpenBBBackend(obbRoute);
  if (obbRaw) desk = obbMergeOpenBBPayload(desk, obbRaw.data || obbRaw.results || obbRaw);

  return obbFinalizeDesk(desk);
}

export function openbbConfigured(){
  return !!(process.env.OPENBB_API_URL && String(process.env.OPENBB_API_URL).trim());
}
