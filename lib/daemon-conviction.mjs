/* Load conviction-lock.js ConvictionLockManager in Node (no browser). */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

export function loadConvictionLockManager(){
  var ctx = vm.createContext({ console: console });
  ctx.globalThis = ctx;
  ctx.window = ctx;
  ctx.evaluateTimeDecay = function(activeSetup, currentCandle, barIndex, maxBars){
    var hold = { action: 'HOLD' };
    try{
      if (!activeSetup) return hold;
      maxBars = maxBars || 8;
      if (!isFinite(barIndex) || !isFinite(activeSetup.executionBarIndex)) return hold;
      if ((barIndex - activeSetup.executionBarIndex) < maxBars) return hold;
      if ((activeSetup.type || 'scalp') !== 'scalp') return hold;
      var state = activeSetup.executionState;
      if (state !== 'FULL_RISK_ON' && state !== 'PARTIAL_RISK_ON') return hold;
      var close = isFinite(currentCandle.c) ? currentCandle.c : currentCandle.close;
      if (!isFinite(close)) return hold;
      var levels = activeSetup.levels || {};
      var entry = isFinite(levels.entryPrice) ? levels.entryPrice
        : (isFinite(levels.entry) ? levels.entry : activeSetup.entry);
      if (!isFinite(entry)) return hold;
      var dir = activeSetup.direction || activeSetup.dir;
      var pnl = (dir === 'long') ? (close - entry) : (entry - close);
      if (pnl <= 0) return { action: 'MARKET_CLOSE_FULL', reason: 'MOMENTUM_DECAY' };
      return { action: 'TRAIL_SL_TIGHT', reason: 'MOMENTUM_WARNING' };
    }catch(e){ return hold; }
  };
  var src = fs.readFileSync(path.join(ROOT, 'conviction-lock.js'), 'utf8');
  var script = new vm.Script(src, { filename: 'conviction-lock.js' });
  script.runInContext(ctx);
  var Mgr = ctx.ConvictionLockManager;
  if (typeof Mgr !== 'function') throw new Error('ConvictionLockManager not exported from conviction-lock.js');
  return Mgr;
}

export function hydrateConvictionManager(mgr, state){
  if (!mgr || !state || !Array.isArray(state.convictions)) return mgr;
  for (var i = 0; i < state.convictions.length; i++){
    var rec = state.convictions[i];
    if (rec && rec.id){
      mgr.hydrateFromRecord(rec, rec.id);
      var setup = mgr.activeConvictions.get(rec.id);
      if (setup){
        if (rec.orderId) setup.orderId = rec.orderId;
        if (rec.ccxtSymbol) setup.ccxtSymbol = rec.ccxtSymbol;
        if (rec.fillSize) setup.fillSize = rec.fillSize;
      }
    }
  }
  return mgr;
}
