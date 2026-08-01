/* =========================================================================
HARDGATE — startrader.js
STARTRADER crypto CFD catalog + Binance USD-M enrichment.

STARTRADER is a CFD broker (MT4/MT5 / proprietary app) with no public REST
market-data API. This module holds their published USD crypto CFD symbols
and enriches them from Binance USDT perps (mark, 24h turnover, funding) —
the same honest proxy discipline as SMART $ / xuCandles Binance fallback.

EXPORTS (window globals, never throw):
  startraderCatalog()        -> [{sym, base}]
  startraderBaseOf(sym)      -> base asset or ''
  startraderBinanceSym(base) -> 'BTCUSDT' etc or null
  startraderNormRows(tickers) -> normalized xuniverse rows (sync)
  startraderUniverseRows()   -> Promise<rows> enriched via binanceTickers24h
  startraderTickers()        -> Promise<index.html ticker shape>
========================================================================= */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

/* USD single-asset crypto CFDs (STARTRADER spec sheet — cross/JPY/XAU pairs excluded) */
var ST_SYM_BASE = [
  ['ADAUSD','ADA'], ['ALGUSD','ALGO'], ['ATMUSD','ATOM'], ['AVAUSD','AVAX'],
  ['AXSUSD','AXS'], ['BATUSD','BAT'], ['BCHUSD','BCH'], ['BERAUSD','BERA'],
  ['BNBUSD','BNB'], ['BTCUSD','BTC'], ['CRVUSD','CRV'], ['DOGUSD','DOGE'],
  ['DOTUSD','DOT'], ['EOSUSD','EOS'], ['ETCUSD','ETC'], ['ETHUSD','ETH'],
  ['FILUSD','FIL'], ['GRTUSD','GRT'], ['HBARUSD','HBAR'], ['INCUSD','1INCH'],
  ['IOTUSD','IOTA'], ['LNKUSD','LINK'], ['LRCUSD','LRC'], ['LTCUSD','LTC'],
  ['MKRUSD','MKR'], ['NEOUSD','NEO'], ['NERUSD','NEAR'], ['ONEUSD','ONE'],
  ['ONDOUSD','ONDO'], ['SANUSD','SAND'], ['SHBUSD','SHIB'], ['SOLUSD','SOL'],
  ['SUSUSD','SUSHI'], ['TRUMPUSD','TRUMP'], ['TRXUSD','TRX'], ['UNIUSD','UNI'],
  ['WIFUSD','WIF'], ['XLMUSD','XLM'], ['XRPUSD','XRP'], ['XTZUSD','XTZ'],
  ['ZECUSD','ZEC']
];

var ST_BASE_MAP = {};
for (var i = 0; i < ST_SYM_BASE.length; i++){
  ST_BASE_MAP[ST_SYM_BASE[i][0]] = ST_SYM_BASE[i][1];
}

function startraderCatalog(){
  return ST_SYM_BASE.map(function(p){ return { sym: p[0], base: p[1] }; });
}

function startraderBaseOf(sym){
  var s = String(sym == null ? '' : sym).toUpperCase();
  return ST_BASE_MAP[s] || s.replace(/USD$/, '');
}

function startraderBinanceSym(base){
  base = String(base == null ? '' : base).toUpperCase();
  if (!base) return null;
  if (base === '1INCH') return '1INCHUSDT';
  return base + 'USDT';
}

function numOrNull(x){
  var n = parseFloat(x);
  return isFinite(n) ? n : null;
}

function startraderNormRows(tickers){
  try{
    var out = [];
    for (var j = 0; j < ST_SYM_BASE.length; j++){
      var sym = ST_SYM_BASE[j][0], base = ST_SYM_BASE[j][1];
      var bSym = startraderBinanceSym(base);
      var t = (tickers && bSym) ? tickers[bSym] : null;
      out.push({
        sym: sym,
        base: base,
        exchange: 'startrader',
        turnoverUsd: t ? numOrNull(t.turnoverUsd) : null,
        mark: t ? numOrNull(t.mark) : null,
        fundingPct: null,
        oiUsd: null,
        oiContracts: null,
        alsoOn: (t && bSym) ? bSym : null
      });
    }
    return out;
  }catch(e){ return []; }
}

async function startraderUniverseRows(){
  try{
    var tickers = null;
    if (typeof G.binanceTickers24h === 'function') tickers = await G.binanceTickers24h();
    var rows = startraderNormRows(tickers);
    if (typeof G.binanceFunding === 'function'){
      for (var i = 0; i < rows.length; i++){
        var b = startraderBinanceSym(rows[i].base);
        if (!b) continue;
        try{
          var f = await G.binanceFunding(b);
          if (f && isFinite(f.fundingPct)) rows[i].fundingPct = f.fundingPct;
        }catch(e){}
      }
    }
    return rows;
  }catch(e){ return startraderNormRows(null); }
}

async function startraderTickers(){
  try{
    var rows = await startraderUniverseRows();
    return rows.map(function(r){
      return {
        symbol: r.sym,
        mark: r.mark,
        fundingPct: r.fundingPct,
        oiUsd: 0,
        turnoverUsd: r.turnoverUsd || 0,
        chg24: null
      };
    }).filter(function(t){ return isFinite(t.mark) || t.turnoverUsd > 0; });
  }catch(e){ return []; }
}

try{
  G.startraderCatalog = startraderCatalog;
  G.startraderBaseOf = startraderBaseOf;
  G.startraderBinanceSym = startraderBinanceSym;
  G.startraderNormRows = startraderNormRows;
  G.startraderUniverseRows = startraderUniverseRows;
  G.startraderTickers = startraderTickers;
}catch(e){}

})();
