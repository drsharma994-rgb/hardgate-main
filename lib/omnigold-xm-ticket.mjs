/* HARDGATE — OMNIGOLD ticket gate (pure, no Node, no XM POST).
   Shared by the live gold-lot sender and the bot backtest. */

function num(v){
  var n = +v;
  return isFinite(n) ? n : NaN;
}

export function ogXmClipLots(n, maxLots){
  var max = isFinite(+maxLots) && +maxLots > 0 ? +maxLots : 0.10;
  var x = Math.floor((+n) * 100 + 1e-9) / 100;
  if (!(x >= 0.01)) return 0;
  if (x > max) x = Math.floor(max * 100 + 1e-9) / 100;
  return x;
}

export function ogXmTicketOk(cand){
  if (!cand || typeof cand !== 'object') return false;
  var ticket = cand.ticket === true || !!(cand.grade && cand.grade.ticket === true);
  if (!ticket) return false;
  if (cand.grade && Array.isArray(cand.grade.vetoes) && cand.grade.vetoes.length){
    return false;
  }
  var dir = cand.dir === 'short' ? 'short' : (cand.dir === 'long' ? 'long' : '');
  if (!dir) return false;
  var plan = cand.plan;
  if (!plan) return false;
  var e = num(plan.entry);
  var s = num(plan.stop);
  var t = num(plan.t1);
  if (!(e > 0 && s > 0 && t > 0)) return false;
  if (dir === 'long' && !(s < e && t > e)) return false;
  if (dir === 'short' && !(s > e && t < e)) return false;
  return true;
}

export function ogXmGoldSymbolOk(sym, cfg){
  cfg = cfg || {};
  var s = String(sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return true;
  var want = String(cfg.symbol || 'XAUUSD').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s === want) return true;
  if ((s === 'XAUUSD' || s === 'GOLD' || s === 'XAUUSDT') &&
      (want === 'XAUUSD' || want === 'GOLD' || want === 'XAUUSDT')) return true;
  return false;
}
