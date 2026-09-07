/* structure/divergence_regular.js + divergence_hidden.js — Increment 6 */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
function split(divs){
  var regular = [], hidden = [];
  (divs || []).forEach(function(d){
    if (!d) return;
    if (d.nature === 'hidden' || d.type === 'hidden') hidden.push(d);
    else regular.push(d);
  });
  return { regular: regular, hidden: hidden };
}
G.hgDetectDivergenceRegular = function(rows, opts){
  if (typeof G.hgDetectDivergences !== 'function') return [];
  return split(G.hgDetectDivergences(rows, opts)).regular;
};
G.hgDetectDivergenceHidden = function(rows, opts){
  if (typeof G.hgDetectDivergences !== 'function') return [];
  return split(G.hgDetectDivergences(rows, opts)).hidden;
};
})();
