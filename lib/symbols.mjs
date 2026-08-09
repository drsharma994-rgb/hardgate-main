/* HARDGATE — instrument metadata (StockSharp SecurityTypes-style). */

export const HG_ASSET_CLASS = {
  CRYPTO_PERP: 'crypto-perp',
  CRYPTO_SPOT: 'crypto-spot',
  GOLD_CFD: 'gold-cfd',
  GOLD_PROXY: 'gold-proxy',
  FX: 'fx',
  OTHER: 'other',
};

export function hgClassifySymbol(sym, opts){
  opts = opts || {};
  var s = String(sym || '').trim().toUpperCase();
  if (!s) return { sym: s, assetClass: HG_ASSET_CLASS.OTHER };
  if (opts.proxy || /PROXY|YAHOO|TWELVE/i.test(String(opts.source || ''))){
    return { sym: s, assetClass: HG_ASSET_CLASS.GOLD_PROXY, venue: opts.venue || 'proxy' };
  }
  if (/^(XAU|XAUT|GOLD|PAXG)/.test(s) || /XAUUSD|XAUTUSD/.test(s)){
    return { sym: s, assetClass: HG_ASSET_CLASS.GOLD_CFD, venue: opts.venue || 'delta' };
  }
  if (/USDT:USDT|\/USDT:USDT|PERP|SWAP/i.test(s) || (s.endsWith('USDT') && s.length <= 12)){
    return { sym: s, assetClass: HG_ASSET_CLASS.CRYPTO_PERP, venue: opts.venue || 'ccxt' };
  }
  if (/BTC|ETH|SOL|BNB|ADA|XRP|DOGE/.test(s)){
    return { sym: s, assetClass: HG_ASSET_CLASS.CRYPTO_PERP, venue: opts.venue || 'mixed' };
  }
  return { sym: s, assetClass: HG_ASSET_CLASS.OTHER };
}

export function hgSymbolWeekendSensitive(meta){
  meta = meta || {};
  return meta.assetClass === HG_ASSET_CLASS.GOLD_CFD || meta.assetClass === HG_ASSET_CLASS.GOLD_PROXY;
}
