/* structure/fvg.js — Increment 6 canonical FVG detector (re-export) */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
G.hgStructureDetectFvg = function(rows, opts){
  if (typeof G.hgDetectFvg !== 'function') return [];
  return G.hgDetectFvg(rows, opts);
};
})();
