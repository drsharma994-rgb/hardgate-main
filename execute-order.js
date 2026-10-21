/**
 * HARDGATE signed-order helper. The desk does not call this.
 * A browser-held exchange secret is stealable on this page, and Binance
 * rejects the cross-origin POST. Orders stay manual.
 */
(function (root) {
  'use strict';
  function OrderRouter(){}
  OrderRouter.prototype.createHmacSha256 = function(secret, message){
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function(key){ return crypto.subtle.sign('HMAC', key, enc.encode(message)); })
      .then(function(signature){
        return Array.from(new Uint8Array(signature)).map(function(b){ return b.toString(16).padStart(2, '0'); }).join('');
      });
  };
  OrderRouter.prototype.executeBinanceFuturesOrder = function(){
    return Promise.reject(new Error('Browser order routing is disabled. Place the bracket on the exchange.'));
  };
  root.HG_OrderRouter = OrderRouter;
})(typeof globalThis !== 'undefined' ? globalThis : this);
