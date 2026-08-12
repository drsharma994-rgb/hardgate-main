/* HARDGATE — cooldown + stoploss guard (documented protection behaviour).
   Technique: Freqtrade protection plugins — clean-room from documented behaviour. */

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

function tsMs(t){
  if (t == null) return null;
  if (typeof t === 'number' && isFinite(t)) return t;
  var d = new Date(t);
  return isFinite(d.getTime()) ? d.getTime() : null;
}

function symNorm(s){
  return String(s || '').toUpperCase().replace(/USDT|USD|PERP/g, '').trim() || 'UNKNOWN';
}

function isStoplossTrade(t){
  if (!t) return false;
  if (t.exitReason && /stop|sl|liquidat/i.test(String(t.exitReason))) return true;
  var r = num(t.r ?? t.R ?? t.realizedR ?? t.closeProfit);
  if (r !== null && r < (num(t.requiredProfit) ?? 0)) return true;
  if (t.stopped === true || t.status === 'stopped') return true;
  return false;
}

/** Per-pair cooldown after any close (Freqtrade CooldownPeriod). */
export function ftCooldownCheck(trades, pair, nowMs, cfg = {}){
  cfg = cfg || {};
  var lookbackMin = num(cfg.lookbackMinutes) ?? 60;
  var cooldownMin = num(cfg.cooldownMinutes) ?? 30;
  var sym = symNorm(pair);
  var now = num(nowMs) ?? Date.now();
  var cutoff = now - lookbackMin * 60000;
  var recent = null;
  for (var i = 0; i < (trades || []).length; i++){
    var t = trades[i];
    if (symNorm(t.symbol || t.sym || t.pair) !== sym) continue;
    var closed = tsMs(t.closedAt ?? t.close_date ?? t.ts ?? t.at);
    if (closed === null || closed < cutoff) continue;
    if (!recent || closed > recent.closed) recent = { trade: t, closed: closed };
  }
  if (!recent) return { lock: false, until: null, reason: null };
  var until = recent.closed + cooldownMin * 60000;
  if (now >= until) return { lock: false, until: null, reason: null };
  return {
    lock: true,
    until: until,
    reason: 'ft-cooldown(' + sym + ',' + cooldownMin + 'm)',
  };
}

/** Stoploss guard — too many stopouts in lookback (Freqtrade StoplossGuard). */
export function ftStoplossGuardCheck(trades, pair, side, nowMs, cfg = {}){
  cfg = cfg || {};
  var tradeLimit = num(cfg.tradeLimit) ?? 4;
  var lookbackMin = num(cfg.lookbackMinutes) ?? 240;
  var requiredProfit = num(cfg.requiredProfit) ?? 0;
  var onlyPerPair = cfg.onlyPerPair !== false;
  var onlyPerSide = cfg.onlyPerSide === true;
  var now = num(nowMs) ?? Date.now();
  var cutoff = now - lookbackMin * 60000;
  var sym = pair != null ? symNorm(pair) : null;
  var sideL = side ? String(side).toLowerCase() : null;
  var stops = 0;
  for (var i = 0; i < (trades || []).length; i++){
    var t = trades[i];
    var closed = tsMs(t.closedAt ?? t.close_date ?? t.ts);
    if (closed === null || closed < cutoff) continue;
    if (sym && symNorm(t.symbol || t.sym) !== sym) continue;
    if (onlyPerSide && sideL && String(t.side || t.dir).toLowerCase() !== sideL) continue;
    t = Object.assign({ requiredProfit: requiredProfit }, t);
    if (!isStoplossTrade(t)) continue;
    var r = num(t.r ?? t.R ?? t.realizedR ?? t.closeProfit);
    if (r !== null && r >= requiredProfit) continue;
    stops++;
  }
  if (stops < tradeLimit){
    return { lock: false, until: null, reason: null, stopCount: stops };
  }
  var scope = sym && onlyPerPair ? sym : 'global';
  return {
    lock: true,
    until: now + lookbackMin * 60000,
    reason: 'ft-stoploss-guard(' + scope + ',' + stops + '/' + tradeLimit + ')',
    stopCount: stops,
  };
}

/** Combined protection check for a formation candidate. */
export function ftProtectionGate(cand, tradeHistory, nowMs, cfg = {}){
  cfg = cfg || {};
  var sym = cand.symbol || cand.sym;
  var side = cand.side || cand.dir;
  var cooldown = ftCooldownCheck(tradeHistory, sym, nowMs, cfg.cooldown || {});
  if (cooldown.lock){
    return { ok: false, reason: cooldown.reason, protection: 'cooldown', until: cooldown.until };
  }
  var guard = ftStoplossGuardCheck(tradeHistory, sym, side, nowMs, cfg.stoplossGuard || {});
  if (guard.lock){
    return { ok: false, reason: guard.reason, protection: 'stoploss_guard', until: guard.until };
  }
  var globalGuard = ftStoplossGuardCheck(tradeHistory, null, side, nowMs,
    Object.assign({}, cfg.stoplossGuard || {}, { onlyPerPair: false }));
  if (globalGuard.lock && cfg.blockGlobalStoplossGuard !== false){
    return { ok: false, reason: globalGuard.reason, protection: 'stoploss_guard_global', until: globalGuard.until };
  }
  return { ok: true, reason: 'ft-protections-clear', protection: null, until: null };
}
