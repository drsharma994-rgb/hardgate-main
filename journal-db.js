/**
 * HARDGATE journal. ARMED setups land in IndexedDB in this browser only.
 */
(function (root) {
  'use strict';
  function JournalDB(){
    this.dbName = 'HardgateJournal';
    this.dbVersion = 1;
    this.db = null;
  }
  JournalDB.prototype.init = function(){
    var self = this;
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    return new Promise(function(resolve){
      var req = indexedDB.open(self.dbName, self.dbVersion);
      req.onupgradeneeded = function(e){
        var db = e.target.result;
        if (!db.objectStoreNames.contains('trades')){
          var store = db.createObjectStore('trades', { keyPath: 'id', autoIncrement: true });
          store.createIndex('symbol', 'symbol', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
      };
      req.onsuccess = function(e){ self.db = e.target.result; resolve(self.db); };
      req.onerror = function(){ resolve(null); };
    });
  };
  JournalDB.prototype.recordSetup = function(setup){
    var self = this;
    return this.init().then(function(){
      if (!self.db) return null;
      return new Promise(function(resolve){
        try {
          var tx = self.db.transaction('trades', 'readwrite');
          var req = tx.objectStore('trades').add(Object.assign({}, setup, { loggedAt: Date.now(), outcome: 'OPEN' }));
          req.onsuccess = function(){ resolve(req.result); };
          req.onerror = function(){ resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  };
  JournalDB.prototype.getAllTrades = function(){
    var self = this;
    return this.init().then(function(){
      if (!self.db) return [];
      return new Promise(function(resolve){
        try {
          var req = self.db.transaction('trades', 'readonly').objectStore('trades').getAll();
          req.onsuccess = function(){ resolve(req.result || []); };
          req.onerror = function(){ resolve([]); };
        } catch (e) { resolve([]); }
      });
    });
  };
  JournalDB.prototype.computeEdgeMetrics = function(){
    return this.getAllTrades().then(function(trades){
      var closed = trades.filter(function(t){ return t.outcome === 'WIN' || t.outcome === 'LOSS'; });
      var wins = closed.filter(function(t){ return t.outcome === 'WIN'; });
      return {
        totalSetups: trades.length,
        closedTrades: closed.length,
        winRate: closed.length ? ((wins.length / closed.length) * 100).toFixed(1) + '%' : '—',
        wins: wins.length,
        losses: closed.length - wins.length
      };
    });
  };
  root.HG_JournalDB = JournalDB;
})(typeof globalThis !== 'undefined' ? globalThis : this);
