/* HARDGATE — scanner → paper fund routing (pure). */
import { pbSanitizeFundId, PB_DEFAULT_FUND } from './paperbook-funds.mjs';

export function bookRouteFund(meta, fallbackFund){
  meta = meta || {};
  if (meta.fund){
    var explicit = pbSanitizeFundId(meta.fund);
    if (explicit) return explicit;
  }
  var strat = String(meta.strategy || meta.source || '').toLowerCase();
  var klass = String(meta.klass || '').toLowerCase();
  if (strat.indexOf('swing') >= 0 || strat === 'goldswing' || strat === 'swing-scalp') return 'swing';
  if (strat.indexOf('scalp') >= 0) return 'swing';
  if (klass === 'metals' || klass === 'metal' || strat.indexOf('gold') >= 0) return 'gold';
  if (strat === 'carry' || strat === 'termbasis' || strat === 'macro') return 'macro';
  var fb = pbSanitizeFundId(fallbackFund);
  return fb || PB_DEFAULT_FUND;
}

export function bookScannerFund(source, meta){
  meta = meta || {};
  if (meta.fund){
    var pinned = pbSanitizeFundId(meta.fund);
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
  return bookRouteFund(meta);
}
