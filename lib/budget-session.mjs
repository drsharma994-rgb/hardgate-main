/* HARDGATE — process-wide budget lock session for /api/execute (Hummingbot budget_checker). */
import { hgBudgetLockState, hgBudgetReserve, hgBudgetRelease } from './budget-checker.mjs';

let __state = hgBudgetLockState();

export function hgBudgetSessionState(){
  return __state;
}

export function hgBudgetSessionReset(){
  __state = hgBudgetLockState();
  return __state;
}

export function hgBudgetNavUsd(env, equityUsd){
  env = env || process.env;
  var nav = env.EXECUTE_NAV_USD != null ? +env.EXECUTE_NAV_USD : NaN;
  if (isFinite(nav) && nav > 0) return nav;
  var eq = +equityUsd;
  if (isFinite(eq) && eq > 0) return eq;
  return 0;
}

export function hgBudgetTryReserve(notionalUsd, navUsd, meta){
  var r = hgBudgetReserve(__state, navUsd, notionalUsd, meta);
  if (r.state) __state = r.state;
  return r;
}

export function hgBudgetTryRelease(lockId){
  if (!lockId) return __state;
  __state = hgBudgetRelease(__state, lockId);
  return __state;
}
