/* Map conviction invalidation status -> CCXT unwind action (testable). */

export function convictionUnwindAction(status){
  var s = String(status || '').toUpperCase();
  if (s === 'EXPIRED') return 'cancel_entry';
  if (s === 'MOMENTUM DECAY' || s === 'MOMENTUM_DECAY') return 'close_position';
  if (s === 'STOPPED' || s === 'INVALIDATED') return 'close_or_cancel';
  if (s === 'TARGET HIT' || s === 'TARGET_HIT') return 'noop';
  return 'noop';
}

export function inferSetupTypeFromBrainRow(row){
  try{
    if (!row) return 'scalp';
    if (row.setupType === 'swing' || row.setupType === 'scalp') return row.setupType;
    var p = row.plan;
    if (p && (p.type === 'swing' || p.type === 'SWING')) return 'swing';
    if (p && (p.type === 'scalp' || p.type === 'SCALP')) return 'scalp';
    var ev = Array.isArray(row.evidence) ? row.evidence.join(' ') : '';
    if (/4H|SWING/i.test(ev)) return 'swing';
  }catch(e){}
  return 'scalp';
}

export async function unwindConvictionOnExchange(setup, status, executor, opts){
  opts = opts || {};
  var log = opts.log || function(){};
  var dryRun = !!opts.dryRun;
  var action = convictionUnwindAction(status);
  if (action === 'noop' || !setup) return { ok: true, action: 'noop' };
  if (!executor){
    if (dryRun) log('[DRY RUN] would unwind ' + setup.id + ' (' + status + ') — no executor');
    return { ok: true, action: action, dryRun: true };
  }

  var sym = setup.sym;
  var ccxtSym = setup.ccxtSymbol || sym;
  var orderId = setup.orderId;
  var side = setup.direction || setup.dir;

  if (action === 'cancel_entry'){
    if (!orderId){
      log('[UNWIND] ' + setup.id + ' EXPIRED — no orderId to cancel');
      return { ok: true, action: 'cancel_entry', skipped: true };
    }
    if (dryRun){
      log('[DRY RUN] would cancel order ' + orderId + ' for ' + sym);
      return { ok: true, action: 'cancel_entry', dryRun: true };
    }
    var cr = await executor.cancelOrder(ccxtSym || sym, orderId);
    if (cr && cr.success) log('[UNWIND] cancelled entry ' + orderId + ' — ' + status);
    else log('[UNWIND FAIL] cancel ' + orderId + ' — ' + ((cr && cr.error) || 'unknown'));
    return cr || { ok: false };
  }

  if (action === 'close_position' || action === 'close_or_cancel'){
    var size = setup.fillSize || setup.orderSize;
    if (dryRun){
      log('[DRY RUN] would close ' + side + ' ' + sym + ' (' + status + ')');
      return { ok: true, action: 'close_position', dryRun: true };
    }
    if (typeof executor.closePosition !== 'function'){
      log('[UNWIND] closePosition not available on executor');
      if (orderId && typeof executor.cancelOrder === 'function'){
        return executor.cancelOrder(ccxtSym || sym, orderId);
      }
      return { ok: false, error: 'closePosition unavailable' };
    }
    var cl = await executor.closePosition({
      sym: sym,
      symbol: ccxtSym || sym,
      dir: side,
      side: side,
      amount: size,
    });
    if (cl && cl.success) log('[UNWIND] closed position ' + sym + ' — ' + status);
    else if (action === 'close_or_cancel' && orderId && typeof executor.cancelOrder === 'function'){
      var cr2 = await executor.cancelOrder(ccxtSym || sym, orderId);
      if (cr2 && cr2.success) log('[UNWIND] cancel fallback ' + orderId + ' — ' + status);
      return cr2 || cl;
    }else{
      log('[UNWIND FAIL] close ' + sym + ' — ' + ((cl && cl.error) || 'unknown'));
    }
    return cl || { ok: false };
  }

  return { ok: true, action: 'noop' };
}
