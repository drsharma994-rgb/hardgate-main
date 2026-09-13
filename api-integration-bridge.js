/* =========================================================================
   HARDGATE Real Data Bridge — Replace mocks with live API data
   
   Hooks api-integration.js functions into macro-feeds.js
   ========================================================================= */
'use strict';

var G = (typeof window !== 'undefined') ? window : globalThis;

/* Override macro feeds with real API calls */
function hgInitRealMacroFeeds(){
  try{
    /* Only init if API integration loaded */
    if (!G.hgComputeRealMacroScore) return false;
    
    /* Update DXY every 60 seconds */
    if (!G.__HG_REAL_FEEDS_STARTED){
      setInterval(function(){
        G.hgGetDXYReal().catch(function(err){
          console.warn('Real DXY update failed:', err);
        });
      }, 60000);
      
      /* Update liquidations every 120 seconds */
      setInterval(function(){
        G.hgGetLiquidationCascades().catch(function(err){
          console.warn('Real liquidation update failed:', err);
        });
      }, 120000);
      
      /* Update funding rates every 60 seconds */
      setInterval(function(){
        G.hgGetFundingRates().catch(function(err){
          console.warn('Real funding rate update failed:', err);
        });
      }, 60000);
      
      G.__HG_REAL_FEEDS_STARTED = true;
    }
    
    /* Override hgComputeMacroScore to use real data */
    var originalMacroScore = G.hgComputeMacroScore;
    G.hgComputeMacroScore = function(){
      /* Try real API first, fall back to mock if offline */
      if (G.hgComputeRealMacroScore){
        return G.hgComputeRealMacroScore().catch(function(err){
          console.warn('Real macro score failed, using mock:', err);
          return originalMacroScore();
        });
      }
      return Promise.resolve(originalMacroScore());
    };
    
    return true;
  }catch(e){
    console.error('Real macro feeds init failed:', e);
    return false;
  }
}

/* Initialize on DOM load */
if (G.document){
  if (G.document.readyState === 'loading'){
    G.document.addEventListener('DOMContentLoaded', hgInitRealMacroFeeds);
  } else {
    hgInitRealMacroFeeds();
  }
}

G.hgInitRealMacroFeeds = hgInitRealMacroFeeds;
