/* HARDGATE — CCXT exchange defaults (aligned with ccxt/ccxt best practices). */

const KNOWN = {
  bybit: {
    defaultType: 'linear',
    adjustForTimeDifference: true,
    recvWindow: 10000,
  },
  binanceusdm: {
    defaultType: 'future',
    adjustForTimeDifference: true,
  },
  binance: {
    defaultType: 'spot',
    adjustForTimeDifference: true,
  },
  delta: {
    defaultType: 'swap',
    adjustForTimeDifference: true,
  },
  okx: {
    defaultType: 'swap',
    adjustForTimeDifference: true,
  },
};

/** Merge env overrides with CCXT-recommended per-venue options. */
export function hgCcxtExchangeOptions(exchangeId, envOverrides){
  var id = String(exchangeId || '').toLowerCase();
  var base = Object.assign({}, KNOWN[id] || { defaultType: 'swap', adjustForTimeDifference: true });
  var ov = envOverrides && typeof envOverrides === 'object' ? envOverrides : {};
  return Object.assign(base, ov);
}

/** Public read-only exchange id for /api/ccxt desk (no API keys). */
export function hgCcxtMarketExchangeId(env){
  env = env || process.env;
  return String(env.CCXT_MARKET_EXCHANGE || env.EXECUTE_CCXT_EXCHANGE || 'binanceusdm').toLowerCase();
}

/** Symbols polled on CCXT desk snapshot. */
export function hgCcxtDeskSymbols(env){
  env = env || process.env;
  var raw = env.CCXT_MARKET_SYMBOLS || 'BTC/USDT:USDT,ETH/USDT:USDT';
  return String(raw).split(',').map(function(s){ return s.trim(); }).filter(Boolean);
}
