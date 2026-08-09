/* HARDGATE — composable pre-trade risk rule chain (StockSharp IRiskRule pattern). */
import { killSwitchEvaluate, killSwitchCfgFromEnv } from './kill-switch.mjs';
import { parseMaxDailyLossPct } from './paperbook-core.mjs';

export function riskRulesCfgFromEnv(env){
  env = env || process.env;
  return {
    killSwitch: killSwitchCfgFromEnv(env),
    maxDailyLossPct: parseMaxDailyLossPct(env.BOOK_MAX_DAILY_LOSS_PCT),
    maxNotionalUsd: env.EXECUTE_MAX_NOTIONAL_USD ? +env.EXECUTE_MAX_NOTIONAL_USD : 0,
    requireAuth: true,
  };
}

/**
 * Run risk rules before execute/daemon trade.
 * ctx: { dayPnlFrac, dailyLossBreached, notionalUsd, navUsd, manualHalt }
 */
export function runRiskRules(ctx, cfg){
  cfg = cfg || riskRulesCfgFromEnv();
  ctx = ctx || {};
  var violations = [];

  var ks = killSwitchEvaluate(ctx.dayPnlFrac, cfg.killSwitch);
  if (ks.halted) violations.push({ rule: 'kill_switch', reason: ks.reason });

  if (ctx.manualHalt){
    violations.push({ rule: 'manual_halt', reason: 'HARDGATE_TRADING_HALT=1' });
  }

  if (ctx.dailyLossBreached){
    violations.push({ rule: 'daily_loss', reason: 'daily loss limit breached' });
  }

  if (cfg.maxNotionalUsd > 0 && isFinite(+ctx.notionalUsd) && +ctx.notionalUsd > cfg.maxNotionalUsd){
    violations.push({ rule: 'max_notional', reason: 'notional exceeds EXECUTE_MAX_NOTIONAL_USD' });
  }

  if (ctx.cooldownBlocked){
    violations.push({ rule: 'cooldown', reason: ctx.cooldownReason || 'cooldown active' });
  }

  return {
    ok: violations.length === 0,
    violations: violations,
    reason: violations.length ? violations.map(function(v){ return v.reason; }).join('; ') : undefined,
  };
}
