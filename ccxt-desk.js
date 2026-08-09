/* HARDGATE — CCXT public market desk bridge for formation + FTS stack.
   Fetches /api/ccxt/desk (funding + tickers) and exposes sync getters. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;

var __ccxtSnap = null;
var __ccxtBusy = false;
var __ccxtAt = 0;
var CCXT_TTL = 3 * 60 * 1000;

function ccxtFundingAnnualPct(r){
  if (r == null || !isFinite(+r)) return null;
  return Math.round(+r * 3 * 365 * 100 * 100) / 100;
}

function ccxtFundingFormationBoost(dir, leg){
  if (!leg || leg.fundingRate == null) return 0;
  var side = String(dir || 'long').toLowerCase();
  var ann = leg.fundingAnnualPct != null ? +leg.fundingAnnualPct : ccxtFundingAnnualPct(leg.fundingRate);
  if (!isFinite(ann)) return 0;
  if (side === 'long'){
    if (ann >= 35) return -12;
    if (ann >= 18) return -7;
    if (ann >= 8) return -3;
    if (ann <= -35) return 12;
    if (ann <= -18) return 7;
    if (ann <= -8) return 3;
    return 0;
  }
  if (ann <= -35) return -12;
  if (ann <= -18) return -7;
  if (ann <= -8) return -3;
  if (ann >= 35) return 12;
  if (ann >= 18) return 7;
  if (ann >= 8) return 3;
  return 0;
}

function legForSym(desk, sym){
  if (!desk) return null;
  if (desk.legs && desk.legs[sym]) return desk.legs[sym];
  var u = String(sym || '').toUpperCase();
  if (/BTC/.test(u)) return desk.btc;
  if (/ETH/.test(u)) return desk.eth;
  return desk.btc || null;
}

function getCcxtDeskCached(){
  try{
    if (__ccxtSnap) return JSON.parse(JSON.stringify(__ccxtSnap));
    return null;
  }catch(e){ return null; }
}

async function refreshCcxtDesk(force){
  if (__ccxtBusy) return __ccxtSnap;
  if (!force && __ccxtSnap && (Date.now() - __ccxtAt) < CCXT_TTL) return __ccxtSnap;
  __ccxtBusy = true;
  try{
    var url = '/api/ccxt/desk' + (force ? '?refresh=1' : '');
    var res = await fetch(url, { cache: 'no-store' });
    var j = await res.json();
    if (j && j.ok && j.desk){
      __ccxtSnap = j.desk;
      __ccxtAt = Date.now();
    }
  }catch(e){}
  finally{ __ccxtBusy = false; }
  return __ccxtSnap;
}

function ccxtDeskFormationBoost(dir, sym, desk){
  desk = desk || __ccxtSnap;
  var leg = legForSym(desk, sym);
  return ccxtFundingFormationBoost(dir, leg);
}

G.getCcxtDeskCached = getCcxtDeskCached;
G.refreshCcxtDesk = refreshCcxtDesk;
G.ccxtDeskFormationBoost = ccxtDeskFormationBoost;
G.ccxtFundingFormationBoost = ccxtFundingFormationBoost;

try{
  if (typeof G.addEventListener === 'function'){
    G.addEventListener('load', function(){
      setTimeout(function(){ refreshCcxtDesk(false); }, 1200);
    });
  }
}catch(e){}

})();
