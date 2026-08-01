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
  if (klass === 'metals' || klass === 'metal' || strat.indexOf('gold') >= 0) return 'gold';
  if (strat === 'carry' || strat === 'termbasis' || strat === 'macro') return 'macro';
  var fb = sanitize(fallbackFund);
  return fb || 'main';
}
function bookScannerFund(source, meta){
  meta = meta || {};
  if (meta.fund){
    var pinned = sanitize(meta.fund);
    if (pinned) return pinned;
  }
  source = String(source || meta.scanner || '').toLowerCase();
  if (source === 'brain'){
    return meta.lane === 'gold' ? 'gold' : 'main';
  }
  if (source === 'edge' || source === 'startrader'){
    var k = String(meta.klass || '').toLowerCase();
    if (k === 'metal' || k === 'metals') return 'gold';
    if (k === 'fx' || k === 'index' || k === 'commodity') return 'macro';
    return 'swing';
  }
  if (source === 'carry' || source === 'termbasis') return 'macro';
  if (source === 'macro' || source === 'goldpro') return 'gold';
  if (source === 'smart') return 'main';
  if (source === 'finder' || source.indexOf('finder-') === 0){
    var fk = String(meta.klass || '').toLowerCase();
    if (fk === 'metal' || fk === 'metals') return 'gold';
    return 'swing';
  }
  if (source === 'squeeze' || source === 'oiflow' || source === 'liqs' || source === 'trendmx'
      || source === 'meanrev' || source === 'execute' || source === 'best' || source === 'trade-plan'
      || source === 'swing' || source === 'scalp' || source === 'swing-scalp') return 'swing';
  if (source === 'goldswing' || source === 'goldscalp' || source === 'gold-swing'
      || source === 'gold-scalp' || source === 'gold-deep-swing' || source === 'gold-deep-scalp'
      || source === 'gold-setup' || source === 'gold-breakout' || source === 'gold-meanrev') return 'gold';
  return bookRouteFund(meta);
}
window.bookRouteFund = bookRouteFund;
window.hgBookScannerFund = bookScannerFund;
})();
