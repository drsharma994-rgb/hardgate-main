/* HARDGATE — scanner → fund routing (browser global). */
(function(){
'use strict';
function sanitize(id){
  id = String(id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return (id && id.length <= 32) ? id : '';
}
function bookRouteFund(meta, fallbackFund){
  meta = meta || {};
  if (meta.fund){
    var explicit = sanitize(meta.fund);
    if (explicit) return explicit;
  }
  var strat = String(meta.strategy || meta.source || '').toLowerCase();
  var klass = String(meta.klass || '').toLowerCase();
  if (strat.indexOf('swing') >= 0 || strat === 'goldswing' || strat === 'swing-scalp') return 'swing';
  if (strat.indexOf('scalp') >= 0) return 'swing';
  if (klass === 'metals' || strat.indexOf('gold') >= 0) return 'gold';
  if (strat === 'carry' || strat === 'termbasis' || strat === 'macro') return 'macro';
  var fb = sanitize(fallbackFund);
  return fb || 'main';
}
window.bookRouteFund = bookRouteFund;
})();
