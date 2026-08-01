/* =========================================================================
HARDGATE — startrader.js
STARTRADER CFD catalog (crypto · metals · oil · indices · forex) + data
routing. No public STARTRADER API — proxies via Binance fapi (crypto),
getGoldCandles (gold), Yahoo chart API via /api/proxy (oil/FX/indices).

EXPORTS (never throw):
  startraderCatalog() / startraderAllContracts()
  startraderBaseOf(sym) / startraderBinanceSym(base)
  startraderContract(sym) -> meta | null
  startraderCandles(sym, tf, n) -> Promise<rows [{t,o,h,l,c,v}]>
  startraderNormRows / startraderUniverseRows / startraderTickers
  startraderFullTickers() -> all contracts with best-effort marks
========================================================================= */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window
      : (typeof globalThis !== 'undefined' ? globalThis : this);

var ST_CRYPTO = [
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

/* klass: crypto | metal | commodity | index | fx | etf | share — yahoo = Yahoo chart symbol */
var ST_METALS = [
  { sym: 'XAUUSD', base: 'XAU', klass: 'metal', yahoo: null, gold: true, label: 'Gold' },
  { sym: 'XAGUSD', base: 'XAG', klass: 'metal', yahoo: 'SI=F', label: 'Silver' },
  { sym: 'XPTUSD', base: 'XPT', klass: 'metal', yahoo: 'PL=F', label: 'Platinum' },
  { sym: 'XPDUSD', base: 'XPD', klass: 'metal', yahoo: 'PA=F', label: 'Palladium' }
];

var ST_COMMODITIES = [
  { sym: 'USOIL',  base: 'WTI', klass: 'commodity', yahoo: 'CL=F', label: 'WTI Crude' },
  { sym: 'UKOIL',  base: 'BRN', klass: 'commodity', yahoo: 'BZ=F', label: 'Brent Crude' },
  { sym: 'NATGAS', base: 'NG',  klass: 'commodity', yahoo: 'NG=F', label: 'Natural Gas' },
  { sym: 'COPPER', base: 'HG',  klass: 'commodity', yahoo: 'HG=F', label: 'Copper' },
  { sym: 'CORN',   base: 'ZC',  klass: 'commodity', yahoo: 'ZC=F', label: 'Corn' },
  { sym: 'WHEAT',  base: 'ZW',  klass: 'commodity', yahoo: 'ZW=F', label: 'Wheat' },
  { sym: 'COFFEE', base: 'KC',  klass: 'commodity', yahoo: 'KC=F', label: 'Coffee' },
  { sym: 'SUGAR',  base: 'SB',  klass: 'commodity', yahoo: 'SB=F', label: 'Sugar' },
  { sym: 'COCOA',  base: 'CC',  klass: 'commodity', yahoo: 'CC=F', label: 'Cocoa' }
];

var ST_INDICES = [
  { sym: 'U30USD', base: 'DJ30', klass: 'index', yahoo: '^DJI', label: 'Dow Jones 30' },
  { sym: 'SPX500', base: 'SPX', klass: 'index', yahoo: '^GSPC', label: 'S&P 500' },
  { sym: 'NAS100', base: 'NDX', klass: 'index', yahoo: '^NDX', label: 'Nasdaq 100' },
  { sym: 'US2000', base: 'RUT', klass: 'index', yahoo: '^RUT', label: 'Russell 2000' },
  { sym: 'GER40',  base: 'DAX', klass: 'index', yahoo: '^GDAXI', label: 'DAX 40' },
  { sym: 'UK100',  base: 'FTSE', klass: 'index', yahoo: '^FTSE', label: 'FTSE 100' },
  { sym: 'FRA40',  base: 'CAC', klass: 'index', yahoo: '^FCHI', label: 'CAC 40' },
  { sym: 'ESP35',  base: 'IBEX', klass: 'index', yahoo: '^IBEX', label: 'IBEX 35' },
  { sym: 'AUS200', base: 'ASX', klass: 'index', yahoo: '^AXJO', label: 'ASX 200' },
  { sym: 'JPN225', base: 'N225', klass: 'index', yahoo: '^N225', label: 'Nikkei 225' },
  { sym: 'HK50',   base: 'HSI', klass: 'index', yahoo: '^HSI', label: 'Hang Seng' },
  { sym: 'CHN50',  base: 'SSE', klass: 'index', yahoo: '000001.SS', label: 'China A50 proxy' }
];

var ST_FX = [
  { sym: 'EURUSD', base: 'EUR', klass: 'fx', yahoo: 'EURUSD=X', label: 'Euro / USD' },
  { sym: 'GBPUSD', base: 'GBP', klass: 'fx', yahoo: 'GBPUSD=X', label: 'Pound / USD' },
  { sym: 'USDJPY', base: 'JPY', klass: 'fx', yahoo: 'JPY=X', label: 'USD / Yen' },
  { sym: 'USDCHF', base: 'CHF', klass: 'fx', yahoo: 'CHF=X', label: 'USD / Franc' },
  { sym: 'AUDUSD', base: 'AUD', klass: 'fx', yahoo: 'AUDUSD=X', label: 'Aussie / USD' },
  { sym: 'USDCAD', base: 'CAD', klass: 'fx', yahoo: 'CAD=X', label: 'USD / CAD' },
  { sym: 'NZDUSD', base: 'NZD', klass: 'fx', yahoo: 'NZDUSD=X', label: 'Kiwi / USD' },
  { sym: 'EURJPY', base: 'EURJPY', klass: 'fx', yahoo: 'EURJPY=X', label: 'Euro / Yen' },
  { sym: 'EURGBP', base: 'EURGBP', klass: 'fx', yahoo: 'EURGBP=X', label: 'Euro / Pound' },
  { sym: 'GBPJPY', base: 'GBPJPY', klass: 'fx', yahoo: 'GBPJPY=X', label: 'Pound / Yen' },
  { sym: 'EURCHF', base: 'EURCHF', klass: 'fx', yahoo: 'EURCHF=X', label: 'Euro / Franc' },
  { sym: 'EURAUD', base: 'EURAUD', klass: 'fx', yahoo: 'EURAUD=X', label: 'Euro / Aussie' },
  { sym: 'EURNZD', base: 'EURNZD', klass: 'fx', yahoo: 'EURNZD=X', label: 'Euro / Kiwi' },
  { sym: 'GBPAUD', base: 'GBPAUD', klass: 'fx', yahoo: 'GBPAUD=X', label: 'Pound / Aussie' },
  { sym: 'USDNOK', base: 'NOK', klass: 'fx', yahoo: 'NOK=X', label: 'USD / Krone' },
  { sym: 'USDSEK', base: 'SEK', klass: 'fx', yahoo: 'SEK=X', label: 'USD / Krona' },
  { sym: 'USDMXN', base: 'MXN', klass: 'fx', yahoo: 'MXN=X', label: 'USD / Peso' },
  { sym: 'USDZAR', base: 'ZAR', klass: 'fx', yahoo: 'ZAR=X', label: 'USD / Rand' }
];

var ST_ETF = [
  { sym: 'SPY',  base: 'SPY', klass: 'etf', yahoo: 'SPY', label: 'S&P 500 ETF' },
  { sym: 'QQQ',  base: 'QQQ', klass: 'etf', yahoo: 'QQQ', label: 'Nasdaq 100 ETF' },
  { sym: 'DIA',  base: 'DIA', klass: 'etf', yahoo: 'DIA', label: 'Dow ETF' },
  { sym: 'IWM',  base: 'IWM', klass: 'etf', yahoo: 'IWM', label: 'Russell 2000 ETF' },
  { sym: 'GLD',  base: 'GLD', klass: 'etf', yahoo: 'GLD', label: 'Gold ETF' },
  { sym: 'SLV',  base: 'SLV', klass: 'etf', yahoo: 'SLV', label: 'Silver ETF' },
  { sym: 'USO',  base: 'USO', klass: 'etf', yahoo: 'USO', label: 'Oil ETF' },
  { sym: 'TLT',  base: 'TLT', klass: 'etf', yahoo: 'TLT', label: '20Y Treasury ETF' },
  { sym: 'EEM',  base: 'EEM', klass: 'etf', yahoo: 'EEM', label: 'EM Equity ETF' },
  { sym: 'XLE',  base: 'XLE', klass: 'etf', yahoo: 'XLE', label: 'Energy Sector ETF' }
];

var ST_SHARES = [
  { sym: 'AAPL',  base: 'AAPL', klass: 'share', yahoo: 'AAPL', label: 'Apple' },
  { sym: 'MSFT',  base: 'MSFT', klass: 'share', yahoo: 'MSFT', label: 'Microsoft' },
  { sym: 'AMZN',  base: 'AMZN', klass: 'share', yahoo: 'AMZN', label: 'Amazon' },
  { sym: 'GOOGL', base: 'GOOGL', klass: 'share', yahoo: 'GOOGL', label: 'Alphabet' },
  { sym: 'META',  base: 'META', klass: 'share', yahoo: 'META', label: 'Meta' },
  { sym: 'NVDA',  base: 'NVDA', klass: 'share', yahoo: 'NVDA', label: 'Nvidia' },
  { sym: 'TSLA',  base: 'TSLA', klass: 'share', yahoo: 'TSLA', label: 'Tesla' },
  { sym: 'NFLX',  base: 'NFLX', klass: 'share', yahoo: 'NFLX', label: 'Netflix' },
  { sym: 'AMD',   base: 'AMD', klass: 'share', yahoo: 'AMD', label: 'AMD' },
  { sym: 'BABA',  base: 'BABA', klass: 'share', yahoo: 'BABA', label: 'Alibaba' },
  { sym: 'JPM',   base: 'JPM', klass: 'share', yahoo: 'JPM', label: 'JPMorgan' },
  { sym: 'XOM',   base: 'XOM', klass: 'share', yahoo: 'XOM', label: 'Exxon Mobil' }
];

var ST_OTHER = ST_METALS.concat(ST_COMMODITIES, ST_INDICES, ST_FX, ST_ETF, ST_SHARES);

var ST_META = {};
for (var i = 0; i < ST_CRYPTO.length; i++){
  ST_META[ST_CRYPTO[i][0]] = { sym: ST_CRYPTO[i][0], base: ST_CRYPTO[i][1],
    klass: 'crypto', yahoo: null, gold: false, label: ST_CRYPTO[i][1] };
}
for (var j = 0; j < ST_OTHER.length; j++){
  var o = ST_OTHER[j];
  ST_META[o.sym] = { sym: o.sym, base: o.base, klass: o.klass,
    yahoo: o.yahoo, gold: !!o.gold, label: o.label || o.sym };
}

var ST_YAHOO_RES = {
  '15m': { i: '15m', r: '1mo' },
  '1h':  { i: '1h',  r: '3mo' },
  '2h':  { i: '1h',  r: '3mo', agg: 7200 },
  '4h':  { i: '1h',  r: '6mo', agg: 14400 },
  '1d':  { i: '1d',  r: '2y' }
};

function startraderCatalog(){
  return ST_CRYPTO.map(function(p){ return { sym: p[0], base: p[1] }; });
}

function startraderAllContracts(){
  var out = [];
  for (var k in ST_META) if (ST_META.hasOwnProperty(k)) out.push(ST_META[k]);
  out.sort(function(a, b){
    var rank = { crypto: 0, metal: 1, commodity: 2, oil: 2, index: 3, fx: 4, etf: 5, share: 6 };
    var ra = rank[a.klass] || 9, rb = rank[b.klass] || 9;
    if (ra !== rb) return ra - rb;
    return a.sym < b.sym ? -1 : (a.sym > b.sym ? 1 : 0);
  });
  return out;
}

function startraderContract(sym){
  return ST_META[String(sym || '').toUpperCase()] || null;
}

function startraderBaseOf(sym){
  var c = startraderContract(sym);
  if (c) return c.base;
  return String(sym == null ? '' : sym).toUpperCase().replace(/USD$/, '');
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

function stParseYahoo(j){
  try{
    var r = j && j.chart && j.chart.result && j.chart.result[0];
    var ts = r && r.timestamp;
    var q = r && r.indicators && r.indicators.quote && r.indicators.quote[0];
    if (!ts || !q || !q.close) return [];
    var out = [];
    for (var i = 0; i < ts.length; i++){
      var o = q.open && q.open[i], h = q.high && q.high[i], l = q.low && q.low[i], c = q.close[i];
      if (o == null || h == null || l == null || c == null) continue;
      out.push({ t: +ts[i], o: +o, h: +h, l: +l, c: +c,
        v: (q.volume && q.volume[i] != null) ? +q.volume[i] : 0 });
    }
    out.sort(function(a, b){ return a.t - b.t; });
    return out;
  }catch(e){ return []; }
}

function stAggRows(rows, sec){
  if (!sec || sec <= 0) return rows;
  var buckets = new Map();
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    var b = Math.floor(r.t / sec) * sec;
    var cur = buckets.get(b);
    if (!cur) buckets.set(b, { t: b, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v || 0 });
    else { cur.h = Math.max(cur.h, r.h); cur.l = Math.min(cur.l, r.l); cur.c = r.c; cur.v += (r.v || 0); }
  }
  return Array.from(buckets.values()).sort(function(a, b){ return a.t - b.t; });
}

async function stYahooFetch(url){
  try{
    var res = await fetch('/api/proxy?url=' + encodeURIComponent(url));
    if (res && res.ok) return await res.json();
  }catch(e){}
  try{
    var res2 = await fetch(url);
    if (res2 && res2.ok) return await res2.json();
  }catch(e2){}
  return null;
}

async function stYahooCandles(yahooSym, tf, count){
  try{
    var y = ST_YAHOO_RES[tf];
    if (!yahooSym || !y) return [];
    var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(yahooSym)
      + '?interval=' + y.i + '&range=' + y.r;
    var rows = stParseYahoo(await stYahooFetch(url));
    if (y.agg) rows = stAggRows(rows, y.agg);
    return rows.slice(-count);
  }catch(e){ return []; }
}

async function startraderCandles(sym, tf, n){
  try{
    tf = tf || '4h';
    n = Math.max(10, Math.min(500, +(n || 200)));
    var c = startraderContract(sym);
    if (!c) return [];
    if (c.klass === 'crypto'){
      if (typeof G.binanceKlines !== 'function') return [];
      var b = startraderBinanceSym(c.base);
      if (!b) return [];
      var cr = await G.binanceKlines(b, tf, n);
      return Array.isArray(cr) ? cr : [];
    }
    if (c.gold){
      if (typeof G.getXAUCandles === 'function'){
        try{ return await G.getXAUCandles(tf, n); }catch(e1){}
      }
      if (typeof G.getGoldCandles === 'function'){
        var g = await G.getGoldCandles(tf, n);
        return (g && g.rows) ? g.rows.slice(-n) : [];
      }
      return await stYahooCandles('GC=F', tf, n);
    }
    if (c.yahoo) return await stYahooCandles(c.yahoo, tf, n);
    return [];
  }catch(e){ return []; }
}

function startraderNormRows(tickers){
  try{
    var out = [];
    for (var j = 0; j < ST_CRYPTO.length; j++){
      var sym = ST_CRYPTO[j][0], base = ST_CRYPTO[j][1];
      var bSym = startraderBinanceSym(base);
      var t = (tickers && bSym) ? tickers[bSym] : null;
      out.push({
        sym: sym, base: base, exchange: 'startrader',
        turnoverUsd: t ? numOrNull(t.turnoverUsd) : null,
        mark: t ? numOrNull(t.mark) : null,
        fundingPct: null, oiUsd: null, oiContracts: null,
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
      return { symbol: r.sym, mark: r.mark, fundingPct: r.fundingPct,
        oiUsd: 0, turnoverUsd: r.turnoverUsd || 0, chg24: null };
    }).filter(function(t){ return isFinite(t.mark) || t.turnoverUsd > 0; });
  }catch(e){ return []; }
}

async function startraderFullTickers(){
  try{
    var crypto = await startraderTickers();
    var map = {};
    for (var i = 0; i < crypto.length; i++) map[crypto[i].symbol] = crypto[i];
    var all = startraderAllContracts();
    var out = [];
    for (var j = 0; j < all.length; j++){
      var c = all[j];
      if (map[c.sym]){
        out.push(map[c.sym]);
        continue;
      }
      var rows = await startraderCandles(c.sym, '1d', 5);
      var mark = (rows && rows.length) ? rows[rows.length - 1].c : null;
      out.push({ symbol: c.sym, mark: mark, fundingPct: null, oiUsd: 0,
        turnoverUsd: 0, chg24: null, klass: c.klass, label: c.label });
    }
    return out;
  }catch(e){ return []; }
}

try{
  G.startraderCatalog = startraderCatalog;
  G.startraderAllContracts = startraderAllContracts;
  G.startraderContract = startraderContract;
  G.startraderBaseOf = startraderBaseOf;
  G.startraderBinanceSym = startraderBinanceSym;
  G.startraderCandles = startraderCandles;
  G.startraderNormRows = startraderNormRows;
  G.startraderUniverseRows = startraderUniverseRows;
  G.startraderTickers = startraderTickers;
  G.startraderFullTickers = startraderFullTickers;
  G.startraderKlassGroups = function(){
    return { metals: ST_METALS.length, commodities: ST_COMMODITIES.length,
      indices: ST_INDICES.length, fx: ST_FX.length, etf: ST_ETF.length, shares: ST_SHARES.length,
      crypto: ST_CRYPTO.length };
  };
}catch(e){}

})();
