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
  if (klass === 'metals' || strat.indexOf('gold') >= 0) return 'gold';
  if (strat === 'carry' || strat === 'termbasis' || strat === 'macro') return 'macro';
  var fb = pbSanitizeFundId(fallbackFund);
  return fb || PB_DEFAULT_FUND;
}
