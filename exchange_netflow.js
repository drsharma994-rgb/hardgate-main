/* HARDGATE — exchange_netflow.js (Increment 5 spec module)
   Re-exports canonical netflow math from onchain-alt-data.js. */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
function req(name){
  if (typeof G[name] !== 'function') throw new Error('exchange_netflow requires onchain-alt-data.js');
  return G[name];
}
G.hgExchangeNetflowZ = function(flows7d){ return req('hgCalcNetflowZ')(flows7d); };
G.hgExchangeNetflowGate = function(sym, dir, z){ return req('hgNetflowGate')(sym, dir, z); };
})();
