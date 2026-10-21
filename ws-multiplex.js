/**
 * HARDGATE Binance futures multiplex: one socket for all USDT mini-tickers
 * and the force-order liquidation tape. connect() is explicit.
 */
(function (root) {
  'use strict';
  function WsMultiplex(){
    this.ws = null;
    this.tickers = new Map();
    this.recentLiquidations = [];
    this.listeners = new Set();
    this.reconnectAttempts = 0;
    this.closed = false;
  }
  WsMultiplex.prototype.connect = function(){
    if (typeof WebSocket === 'undefined') return;
    var self = this;
    this.closed = false;
    this.ws = new WebSocket('wss://fstream.binance.com/stream?streams=!miniTicker@arr/!forceOrder@arr');
    this.ws.onopen = function(){ self.reconnectAttempts = 0; };
    this.ws.onmessage = function(event){
      try { self.handleMessage(JSON.parse(event.data)); } catch (e) {}
    };
    this.ws.onclose = function(){
      if (self.closed) return;
      var delay = Math.min(1000 * Math.pow(2, self.reconnectAttempts++), 30000);
      setTimeout(function(){ self.connect(); }, delay);
    };
    this.ws.onerror = function(){};
  };
  WsMultiplex.prototype.handleMessage = function(data){
    if (!data || !data.data) return;
    var stream = data.stream, d = data.data, i, item, o, liq;
    if (stream === '!miniTicker@arr' && Array.isArray(d)){
      for (i = 0; i < d.length; i++){
        item = d[i];
        if (!item || !item.s || String(item.s).indexOf('USDT') < 0) continue;
        this.tickers.set(item.s, {
          symbol: item.s, close: parseFloat(item.c), open: parseFloat(item.o),
          high: parseFloat(item.h), low: parseFloat(item.l), volume: parseFloat(item.v),
          updated: Date.now()
        });
      }
    }
    if (stream === '!forceOrder@arr' && d.o){
      o = d.o;
      liq = {
        symbol: o.s, side: o.S, price: parseFloat(o.p), qty: parseFloat(o.q),
        usdValue: +(parseFloat(o.p) * parseFloat(o.q)).toFixed(2), time: d.E
      };
      this.recentLiquidations.unshift(liq);
      if (this.recentLiquidations.length > 50) this.recentLiquidations.pop();
    }
    this.notifyListeners();
  };
  WsMultiplex.prototype.addListener = function(cb){ this.listeners.add(cb); };
  WsMultiplex.prototype.removeListener = function(cb){ this.listeners.delete(cb); };
  WsMultiplex.prototype.notifyListeners = function(){
    this.listeners.forEach(function(cb){ try { cb(); } catch (e) {} });
  };
  root.HG_WsMultiplex = WsMultiplex;
})(typeof globalThis !== 'undefined' ? globalThis : this);
