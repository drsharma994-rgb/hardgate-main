/* primitives/tsmom.js — Increment 6 primitive re-export */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
G.hgTsmom = function(series, opts){ return typeof G.hgPrimitiveTsmom === 'function' ? G.hgPrimitiveTsmom(series, opts) : null; };
})();
