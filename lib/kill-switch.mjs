/* HARDGATE — unified kill switch (Hummingbot-style PnL halt + manual halt). */

export function killSwitchCfgFromEnv(env){
  env = env || process.env;
  var pct = env.HARDGATE_KILL_SWITCH_PCT != null ? +env.HARDGATE_KILL_SWITCH_PCT : NaN;
  if (!isFinite(pct) || pct <= 0) pct = null;
  else if (pct > 1) pct = pct / 100;
  return {
    lossPct: pct,
    profitPct: env.HARDGATE_KILL_SWITCH_PROFIT_PCT != null ? +env.HARDGATE_KILL_SWITCH_PROFIT_PCT / (env.HARDGATE_KILL_SWITCH_PROFIT_PCT > 1 ? 100 : 1) : null,
    manual: env.HARDGATE_KILL_SWITCH === '1' || env.HARDGATE_KILL_SWITCH === 'true',
  };
}

/** Evaluate kill switch from day PnL fraction (−1..+1 of NAV) and config. */
export function killSwitchEvaluate(dayPnlFrac, cfg){
  cfg = cfg || killSwitchCfgFromEnv();
  if (cfg.manual){
    return { halted: true, reason: 'manual kill switch (HARDGATE_KILL_SWITCH=1)' };
  }
  var p = +dayPnlFrac;
  if (!isFinite(p)) return { halted: false };
  if (cfg.lossPct != null && p <= -Math.abs(cfg.lossPct)){
    return { halted: true, reason: 'kill switch: day loss ' + (p * 100).toFixed(2) + '% >= ' + (cfg.lossPct * 100).toFixed(2) + '%' };
  }
  if (cfg.profitPct != null && p >= Math.abs(cfg.profitPct)){
    return { halted: true, reason: 'kill switch: day profit lock ' + (p * 100).toFixed(2) + '%' };
  }
  return { halted: false };
}
