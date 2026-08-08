/* HARDGATE — loss cooldown gate. Pure, never throws.
   Blocks new tickets on a symbol after N consecutive stop-outs. */

export const COOLDOWN_DEFAULTS = {
  lossStreak: 2,
  cooldownMs: 4 * 3600 * 1000,
  dailyLossStreak: 4,
  globalCooldownMs: 12 * 3600 * 1000,
};

export function cooldownCfgFromEnv(env){
  env = env || {};
  function num(v, d){ var n = +v; return (isFinite(n) && n > 0) ? n : d; }
  return {
    lossStreak: num(env.HARDGATE_COOLDOWN_LOSSES, COOLDOWN_DEFAULTS.lossStreak),
    cooldownMs: num(env.HARDGATE_COOLDOWN_HOURS, 4) * 3600 * 1000,
    dailyLossStreak: num(env.HARDGATE_GLOBAL_COOLDOWN_LOSSES, COOLDOWN_DEFAULTS.dailyLossStreak),
    globalCooldownMs: num(env.HARDGATE_GLOBAL_COOLDOWN_HOURS, 12) * 3600 * 1000,
  };
}

/* outcomes: newest-last array of { sym, r, closedAt } (r = realised R, <0 = loss) */
export function lossStreaks(outcomes){
  var bySym = {}, global = 0, globalBroken = false;
  var arr = Array.isArray(outcomes) ? outcomes : [];
  for (var i = arr.length - 1; i >= 0; i--){
    var o = arr[i];
    if (!o || !isFinite(+o.r)) continue;
    var sym = String(o.sym || '');
    var loss = (+o.r) < 0;
    if (!globalBroken){
      if (loss) global++; else globalBroken = true;
    }
    if (bySym[sym] === undefined) bySym[sym] = { streak: 0, broken: false, lastAt: 0 };
    var s = bySym[sym];
    if (!s.broken){
      if (loss){ s.streak++; if (!s.lastAt) s.lastAt = +o.closedAt || 0; }
      else s.broken = true;
    }
  }
  return { bySym: bySym, global: global };
}

export function cooldownCheck(sym, outcomes, cfg, nowMs){
  cfg = Object.assign({}, COOLDOWN_DEFAULTS, cfg || {});
  nowMs = isFinite(+nowMs) ? +nowMs : Date.now();
  var out = { blocked: false, reason: null, untilMs: 0, scope: null };
  try{
    var st = lossStreaks(outcomes);
    if (st.global >= cfg.dailyLossStreak){
      var lastAll = 0, arr = Array.isArray(outcomes) ? outcomes : [];
      for (var i = arr.length - 1; i >= 0; i--){
        if (arr[i] && isFinite(+arr[i].r)){ lastAll = +arr[i].closedAt || 0; break; }
      }
      var untilG = lastAll + cfg.globalCooldownMs;
      if (nowMs < untilG){
        return { blocked: true, scope: 'global', untilMs: untilG,
                 reason: st.global + ' consecutive losses — book paused until ' + new Date(untilG).toISOString() };
      }
    }
    var s = st.bySym[String(sym || '')];
    if (s && s.streak >= cfg.lossStreak){
      var until = (s.lastAt || 0) + cfg.cooldownMs;
      if (nowMs < until){
        return { blocked: true, scope: 'symbol', untilMs: until,
                 reason: s.streak + ' consecutive stops on ' + sym + ' — cooldown until ' + new Date(until).toISOString() };
      }
    }
    return out;
  }catch(e){ return out; }
}
