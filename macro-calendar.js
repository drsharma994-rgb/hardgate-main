/**
 * HARDGATE high-impact USD calendar. 15 minutes either side of a High USD print
 * is a lock. An unread feed locks nothing.
 */
(function (root) {
  'use strict';
  function MacroCalendar(){
    this.bufferMinutes = 15;
    this.events = [];
    this.lastFetch = 0;
    this.cacheDuration = 30 * 60 * 1000;
  }
  MacroCalendar.prototype.refreshEvents = function(){
    var self = this;
    if (Date.now() - this.lastFetch < this.cacheDuration && this.events.length) return Promise.resolve(this.events);
    return fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json')
      .then(function(res){ return res.ok ? res.json() : []; })
      .then(function(raw){
        var list = Array.isArray(raw) ? raw : [];
        self.events = list.filter(function(e){
          return e && String(e.country).toUpperCase() === 'USD' && String(e.impact).toLowerCase() === 'high';
        }).map(function(e){
          return { title: e.title, timestamp: new Date(e.date).getTime() };
        }).filter(function(e){ return isFinite(e.timestamp); });
        self.lastFetch = Date.now();
        return self.events;
      })
      .catch(function(){ return self.events; });
  };
  MacroCalendar.prototype.checkBlackout = function(currentTime){
    currentTime = currentTime || Date.now();
    var bufferMs = this.bufferMinutes * 60 * 1000;
    for (var i = 0; i < this.events.length; i++){
      var ev = this.events[i];
      if (Math.abs(currentTime - ev.timestamp) <= bufferMs){
        var deltaMin = Math.round((ev.timestamp - currentTime) / 60000);
        return {
          veto: true,
          eventName: ev.title,
          evidence: 'High-impact USD event: ' + ev.title + ' (' + (deltaMin >= 0 ? ('in ' + deltaMin + 'm') : (Math.abs(deltaMin) + 'm ago')) + ')'
        };
      }
    }
    return { veto: false, evidence: 'Macro economic window clean' };
  };
  root.HG_MacroCalendar = MacroCalendar;
})(typeof globalThis !== 'undefined' ? globalThis : this);
