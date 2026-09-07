/* primitives/ema_cascade.js — Increment 6 primitive re-export */
(function(){
'use strict';
var G = (typeof window !== 'undefined') ? window : globalThis;
G.hgEmaCascade = function(closes, opts){ return typeof G.hgPrimitiveEmaCascade === 'function' ? G.hgPrimitiveEmaCascade(closes, opts) : null; };
})();
