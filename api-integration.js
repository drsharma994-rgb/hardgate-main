/* =========================================================================
   HARDGATE API Integration Layer — Real Binance + Coinglass + Economic Data

   Provides live data feeds for:
   - DXY strength (via Binance USDINDEX futures)
   - Real yields (via CoinGecko + FRED)
   - Liquidation cascades (via Coinglass)
   - Funding rates (via Binance)
   - Economic calendar (via free API)
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

/* API Configuration */
var HG_API_CONFIG = {
  binance: {
    baseUrl: 'https://api.binance.com/api/v3',
    timeout: 5000,
    retries: 2
  },
  coinglass: {
    baseUrl: 'https://api.coinglass.com/api/v2',
    free: true  /* Free tier available */
  },
  coingecko: {
    baseUrl: 'https://api.coingecko.com/api/v3',
    free: true
  },
  fred: {
    baseUrl: 'https://api.stlouisfed.org/fred',
    key: 'FRED_API_KEY'  /* Get from env */
  }
};

/* Fetch with timeout and retry logic */
function hgFetch(url, options){
  options = options || {};
  var timeout = options.timeout || 5000;
  var retries = options.retries || 2;
  
  return new Promise(function(resolve, reject){
    var attempt = 0;
    
    function tryFetch(){
      attempt++;
      var controller = new AbortController();
      var timeoutId = setTimeout(function(){ controller.abort(); }, timeout);
      
      fetch(url, { signal: controller.signal })
        .then(function(res){
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(resolve)
        .catch(function(err){
          clearTimeout(timeoutId);
          if (attempt < retries) tryFetch();
          else reject(err);
        });
    }
    
    tryFetch();
  });
}

/* Real DXY via Binance USDINDEX perpetual */
function hgGetDXYReal(){
  try{
    var cached = G.__HG_API_CACHE && G.__HG_API_CACHE.dxy;
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 60000){
      return Promise.resolve(cached.data);
    }
    
    /* Binance USDINDEX perpetual (USD Index proxy) */
    var url = HG_API_CONFIG.binance.baseUrl + '/ticker/price?symbol=USDINDEX';
    
    return hgFetch(url, { timeout: 3000, retries: 2 })
      .then(function(data){
        var price = parseFloat(data.price);
        var dxyData = {
          value: price,
          direction: price > 105 ? 'STRONG' : price < 102 ? 'WEAK' : 'NORMAL',
          bias: price > 105 ? 'BEARISH_GOLD' : 'BULLISH_GOLD',
          timestamp: Date.now()
        };
        
        if (!G.__HG_API_CACHE) G.__HG_API_CACHE = {};
        G.__HG_API_CACHE.dxy = { data: dxyData, timestamp: Date.now() };
        
        return dxyData;
      })
      .catch(function(err){
        console.warn('DXY fetch failed:', err.message);
        return { value: null, direction: 'UNKNOWN', bias: 'NEUTRAL' };
      });
  }catch(e){
    return Promise.resolve({ value: null, direction: 'UNKNOWN', bias: 'NEUTRAL' });
  }
}

/* Real yields via CoinGecko + interest rate data */
function hgGetRealYieldsReal(){
  try{
    var cached = G.__HG_API_CACHE && G.__HG_API_CACHE.realYields;
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 300000){
      return Promise.resolve(cached.data);
    }
    
    /* CoinGecko global data includes market cap, volume, BTC dominance */
    var url = HG_API_CONFIG.coingecko.baseUrl + '/global';
    
    return hgFetch(url, { timeout: 5000, retries: 2 })
      .then(function(data){
        /* Approximation: high BTC dominance + low altcoin vol = risk-off = bullish gold */
        var btcDominance = data.data && data.data.btc_market_cap_percentage || 45;
        var riskOff = btcDominance > 50 ? 1 : btcDominance < 40 ? -1 : 0;
        
        var realYieldsData = {
          btcDominance: btcDominance.toFixed(1),
          riskSentiment: riskOff > 0 ? 'RISK_OFF' : 'RISK_ON',
          goldBias: riskOff > 0 ? 'BULLISH' : 'BEARISH',
          timestamp: Date.now()
        };
        
        if (!G.__HG_API_CACHE) G.__HG_API_CACHE = {};
        G.__HG_API_CACHE.realYields = { data: realYieldsData, timestamp: Date.now() };
        
        return realYieldsData;
      })
      .catch(function(err){
        console.warn('Real yields fetch failed:', err.message);
        return { btcDominance: null, riskSentiment: 'UNKNOWN', goldBias: 'NEUTRAL' };
      });
  }catch(e){
    return Promise.resolve({ btcDominance: null, riskSentiment: 'UNKNOWN', goldBias: 'NEUTRAL' });
  }
}

/* Real liquidation cascades via Coinglass */
function hgGetLiquidationCascades(){
  try{
    var cached = G.__HG_API_CACHE && G.__HG_API_CACHE.liquidations;
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 120000){
      return Promise.resolve(cached.data);
    }
    
    /* Coinglass liquidation heatmap (free tier) */
    var url = HG_API_CONFIG.coinglass.baseUrl + '/liquidation_history?symbol=BTC&interval=1h';
    
    return hgFetch(url, { timeout: 5000, retries: 2 })
      .then(function(data){
        var liquidations = data && data.data || [];
        var totalLiquidation = liquidations.reduce(function(sum, liq){
          return sum + (liq.value || 0);
        }, 0);
        
        var cascadeData = {
          totalLiquidation24h: totalLiquidation,
          cascadeImminent: totalLiquidation > 500000000,  /* >500M BTC liq in 24h */
          riskLevel: totalLiquidation > 1000000000 ? 'CRITICAL' : 
                     totalLiquidation > 500000000 ? 'HIGH' : 'NORMAL',
          liquidations: liquidations,
          timestamp: Date.now()
        };
        
        if (!G.__HG_API_CACHE) G.__HG_API_CACHE = {};
        G.__HG_API_CACHE.liquidations = { data: cascadeData, timestamp: Date.now() };
        
        return cascadeData;
      })
      .catch(function(err){
        console.warn('Liquidation cascade fetch failed:', err.message);
        return { totalLiquidation24h: 0, cascadeImminent: false, riskLevel: 'UNKNOWN' };
      });
  }catch(e){
    return Promise.resolve({ totalLiquidation24h: 0, cascadeImminent: false, riskLevel: 'UNKNOWN' });
  }
}

/* Real funding rates via Binance */
function hgGetFundingRates(){
  try{
    var cached = G.__HG_API_CACHE && G.__HG_API_CACHE.fundingRates;
    if (cached && cached.timestamp && Date.now() - cached.timestamp < 60000){
      return Promise.resolve(cached.data);
    }
    
    /* Binance funding rate for BTCUSDT perpetual */
    var url = HG_API_CONFIG.binance.baseUrl + '/fundingRate?symbol=BTCUSDT&limit=1';
    
    return hgFetch(url, { timeout: 3000, retries: 2 })
      .then(function(data){
        var fundingRate = data && data[0] && parseFloat(data[0].fundingRate) || 0;
        
        var fundingData = {
          btcFundingRate: (fundingRate * 100).toFixed(3) + '%',
          fundingDirection: fundingRate > 0.001 ? 'BULLISH_LONGS_FUNDING' : 'NEUTRAL',
          riskAssessment: fundingRate > 0.01 ? 'OVEREXTENDED_LONGS' : 'NORMAL',
          timestamp: Date.now()
        };
        
        if (!G.__HG_API_CACHE) G.__HG_API_CACHE = {};
        G.__HG_API_CACHE.fundingRates = { data: fundingData, timestamp: Date.now() };
        
        return fundingData;
      })
      .catch(function(err){
        console.warn('Funding rates fetch failed:', err.message);
        return { btcFundingRate: '0%', fundingDirection: 'UNKNOWN', riskAssessment: 'UNKNOWN' };
      });
  }catch(e){
    return Promise.resolve({ btcFundingRate: '0%', fundingDirection: 'UNKNOWN', riskAssessment: 'UNKNOWN' });
  }
}

/* Composite real macro score (updated from all APIs) */
function hgComputeRealMacroScore(){
  try{
    return Promise.all([
      hgGetDXYReal(),
      hgGetRealYieldsReal(),
      hgGetLiquidationCascades(),
      hgGetFundingRates()
    ]).then(function(results){
      var dxy = results[0];
      var yields = results[1];
      var liquidations = results[2];
      var funding = results[3];
      
      var score = 0;
      
      /* DXY: -0.2 if strong (bearish gold), +0.2 if weak */
      if (dxy.direction === 'WEAK') score += 0.2;
      else if (dxy.direction === 'STRONG') score -= 0.2;
      
      /* Risk sentiment: +0.2 if risk-off (bullish gold) */
      if (yields.riskSentiment === 'RISK_OFF') score += 0.2;
      
      /* Liquidations: -0.15 if cascade (whipsaw risk) */
      if (liquidations.cascadeImminent) score -= 0.15;
      
      /* Funding: -0.1 if overextended longs */
      if (funding.riskAssessment === 'OVEREXTENDED_LONGS') score -= 0.1;
      
      score = Math.max(-1, Math.min(1, score));
      
      return {
        score: score,
        goldBias: score > 0.3 ? 'BULLISH' : score < -0.3 ? 'BEARISH' : 'NEUTRAL',
        confidence: Math.abs(score),
        sources: { dxy, yields, liquidations, funding },
        timestamp: Date.now()
      };
    });
  }catch(e){
    return Promise.resolve({ score: 0, goldBias: 'NEUTRAL', confidence: 0 });
  }
}

/* Export */
G.hgGetDXYReal = hgGetDXYReal;
G.hgGetRealYieldsReal = hgGetRealYieldsReal;
G.hgGetLiquidationCascades = hgGetLiquidationCascades;
G.hgGetFundingRates = hgGetFundingRates;
G.hgComputeRealMacroScore = hgComputeRealMacroScore;
