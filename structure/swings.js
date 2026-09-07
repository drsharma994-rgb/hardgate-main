/* structure/swings.js — Increment 6 canonical swing detector (re-export) */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
G.hgStructureDetectSwings = function(rows, opts){
  if (typeof G.hgDetectSwings !== 'function') return { swings: [], bos: [], choch: [] };
  return G.hgDetectSwings(rows, opts);
};
})();
