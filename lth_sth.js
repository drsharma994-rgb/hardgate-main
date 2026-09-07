/* HARDGATE — lth_sth.js (Increment 5 spec module) */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
G.hgLthSthDynamics = function(lth, sth, d30, goldShare){
  if (typeof G.hgLthSthSupplyDynamics !== 'function') return null;
  return G.hgLthSthSupplyDynamics(lth, sth, d30, goldShare);
};
})();
