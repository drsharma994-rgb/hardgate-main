/* HARDGATE — server-side CCXT public market snapshot (funding + tickers). */
import { hgCcxtExchangeOptions, hgCcxtMarketExchangeId, hgCcxtDeskSymbols } from './ccxt-config.mjs';
import { ccxtNormalizeLeg, ccxtFinalizeDesk } from './ccxt-market-core.mjs';

const TIMEOUT_MS = 15000;
let __exchangeCache = null;

async function loadPublicExchange(exchangeId){
  if (__exchangeCache && __exchangeCache.id === exchangeId) return __exchangeCache.ex;
  var mod = await import('ccxt');
  var ccxt = mod.default || mod;
  var Ex = ccxt[exchangeId];
  if (!Ex) throw new Error('Unsupported CCXT market exchange: ' + exchangeId);
  var ex = new Ex({
    enableRateLimit: true,
    options: hgCcxtExchangeOptions(exchangeId),
  });
  await ex.loadMarkets();
  __exchangeCache = { id: exchangeId, ex: ex };
  return ex;
}

function withTimeout(promise, ms){
  return Promise.race([
    promise,
    new Promise(function(_, reject){
      setTimeout(function(){ reject(new Error('ccxt fetch timeout')); }, ms);
    }),
  ]);
}

async function fetchLeg(ex, symbol){
  var funding = null, ticker = null;
  try{
    if (typeof ex.fetchFundingRate === 'function'){
      funding = await withTimeout(ex.fetchFundingRate(symbol), TIMEOUT_MS);
    }
  }catch(e){}
  try{
    ticker = await withTimeout(ex.fetchTicker(symbol), TIMEOUT_MS);
  }catch(e){}
  return ccxtNormalizeLeg(symbol, funding, ticker);
}

/** Build CCXT desk from public endpoints (no API keys required). */
export async function fetchCcxtDesk(env){
  env = env || process.env;
  var exchangeId = hgCcxtMarketExchangeId(env);
  var symbols = hgCcxtDeskSymbols(env);
  var desk = { exchange: exchangeId, legs: {}, at: Date.now(), source: 'ccxt-public' };
  try{
    var ex = await loadPublicExchange(exchangeId);
    var results = await Promise.all(symbols.map(function(sym){
      return fetchLeg(ex, sym).then(function(leg){ return { sym: sym, leg: leg }; });
    }));
    for (var i = 0; i < results.length; i++){
      var row = results[i];
      if (row && row.leg) desk.legs[row.sym] = row.leg;
    }
  }catch(e){
    desk.error = (e && e.message) || String(e);
  }
  return ccxtFinalizeDesk(desk);
}

export function ccxtMarketConfigured(env){
  env = env || process.env;
  return !!hgCcxtMarketExchangeId(env);
}
