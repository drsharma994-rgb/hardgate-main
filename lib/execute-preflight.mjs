/* HARDGATE — VWAP clip sizing + budget reserve before CCXT execute. */
import { hgApplyVwapSizing } from './vwap-sizing.mjs';
import { hgNormalizeCcxtSymbol } from './hardgate-executor.mjs';
import { hgBudgetTryReserve, hgBudgetTryRelease, hgBudgetNavUsd } from './budget-session.mjs';

function envFlag(env, key, defaultOn){
  env = env || process.env;
  if (env[key] == null) return defaultOn;
  var v = String(env[key]).toLowerCase();
  if (v === '0' || v === 'false' || v === 'off') return false;
  return true;
}

export function hgExecutePreflightFlags(env){
  env = env || process.env;
  return {
    vwap: envFlag(env, 'EXECUTE_VWAP_SIZING', true),
    budget: envFlag(env, 'EXECUTE_BUDGET_CHECK', true),
    maxSpreadBps: env.EXECUTE_VWAP_MAX_SPREAD_BPS != null ? +env.EXECUTE_VWAP_MAX_SPREAD_BPS : 25,
  };
}

export async function hgFetchOrderBook(exec, payload){
  var ex = await exec.init();
  var sym = hgNormalizeCcxtSymbol(payload.symbol || payload.sym, ex.markets);
  var depth = Math.max(5, Math.min(50, +(process.env.EXECUTE_VWAP_DEPTH || 20)));
  var ob = await ex.fetchOrderBook(sym, depth);
  return { bids: ob.bids || [], asks: ob.asks || [], symbol: sym };
}

async function hgResolveNavUsd(exec, env){
  var nav = hgBudgetNavUsd(env);
  if (nav > 0) return nav;
  if (!exec || typeof exec.calculateOrderSize !== 'function') return 0;
  try{
    var sym = 'BTC/USDT:USDT';
    var sized = await exec.calculateOrderSize(sym, 100000, 99000, 1);
    return sized && sized.equityUSDT > 0 ? sized.equityUSDT : 0;
  }catch(e){
    return 0;
  }
}

function hgPayloadNotional(payload){
  var entry = +(payload.entry || payload.limitPrice || 0);
  var qty = +(payload.qty || 0);
  if (!(qty > 0)) return 0;
  if (entry > 0) return qty * entry;
  return +(payload.notionalUsd || 0);
}

/**
 * Apply depth-aware qty clip + budget lock before live execute.
 * Returns { ok, payload, budgetLockId, preflightNotes, reason }.
 */
export async function hgPrepareExecutePayload(exec, payload, opts){
  opts = opts || {};
  var env = opts.env || process.env;
  var flags = hgExecutePreflightFlags(env);
  var out = Object.assign({}, payload);
  var notes = [];
  var lockId = null;

  if (flags.vwap && exec){
    try{
      var book = await hgFetchOrderBook(exec, out);
      var plan = {
        side: out.side,
        dir: out.side,
        qty: out.qty,
        entry: out.entry || out.limitPrice,
        notionalUsd: out.notionalUsd,
      };
      var sized = hgApplyVwapSizing(plan, book, { maxSpreadBps: flags.maxSpreadBps });
      if (sized.qty > 0 && sized.qty !== out.qty){
        out.qty = sized.qty;
        if (sized.vwapNote) out.vwapNote = sized.vwapNote;
        if (sized.vwapFilledUsd != null) out.vwapFilledUsd = sized.vwapFilledUsd;
        notes.push('vwap:' + sized.vwapNote);
      }
    }catch(e){
      notes.push('vwap:skipped');
    }
  }

  if (flags.budget){
    var notional = hgPayloadNotional(out);
    if (notional > 0){
      var nav = await hgResolveNavUsd(exec, env);
      if (nav > 0){
        var br = hgBudgetTryReserve(notional, nav, {
          sym: out.symbol || out.sym,
          idem: out.idempotencyKey,
        });
        if (!br.ok){
          return { ok: false, reason: br.reason, payload: out, preflightNotes: notes };
        }
        lockId = br.lockId;
        notes.push('budget:locked');
      } else {
        notes.push('budget:skipped-no-nav');
      }
    }
  }

  return { ok: true, payload: out, budgetLockId: lockId, preflightNotes: notes };
}

export function hgReleaseExecuteBudget(lockId){
  hgBudgetTryRelease(lockId);
}
