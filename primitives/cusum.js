/* primitives/cusum.js — Increment 6 primitive re-export */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
G.hgCusum = function(series, opts){ return typeof G.hgPrimitiveCusum === 'function' ? G.hgPrimitiveCusum(series, opts) : null; };
})();
