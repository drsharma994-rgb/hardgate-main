/* structure/order_blocks.js — Increment 6 canonical OB detector (re-export) */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
G.hgStructureDetectOrderBlocks = function(rows, swings, opts){
  if (typeof G.hgDetectOrderBlocks !== 'function') return [];
  return G.hgDetectOrderBlocks(rows, swings, opts);
};
})();
