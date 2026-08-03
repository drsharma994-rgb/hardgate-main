/* Pure helpers + one market-scan pass (testable without Puppeteer). */

export function filterExecutableBrainRows(rows, tiers){
  tiers = tiers || ['PRIME', 'HIGH'];
  var out = [];
  if (!Array.isArray(rows)) return out;
  for (var i = 0; i < rows.length; i++){
    var row = rows[i];
    if (!row || !row.plan || !row.dir) continue;
    if (tiers.indexOf(row.tier) < 0) continue;
    var p = row.plan;
    if (!isFinite(p.entry) || !isFinite(p.stop) || !isFinite(p.t1)) continue;
    if (Math.abs(p.entry - p.stop) <= 0) continue;
    out.push(row);
  }
  return out;
}

export function brainRowToLockSetup(row, setupType){
  setupType = setupType || 'scalp';
  var p = row.plan;
  var anchor = isFinite(p.entry) ? p.entry : NaN;
  return {
    id: 'brain|' + String(row.dir) + '|' + Math.round(anchor) + '|' + String(row.sym),
    type: setupType,
    direction: row.dir,
    dir: row.dir,
    sym: row.sym,
    stratKey: 'brain',
    levels: {
      entry: p.entry,
      stopLoss: p.stop,
      tp1: p.t1,
      tp2: isFinite(p.t2) ? p.t2 : undefined,
      anchor: anchor,
    },
    tally: Array.isArray(row.evidence) ? row.evidence.length : 0,
    timestamp: Date.now(),
    status: 'ACTIVE',
  };
}

export function brainRowToTradePlan(row){
  var p = row.plan;
  return {
    sym: row.sym,
    symbol: row.sym,
    dir: row.dir,
    side: row.dir,
    entry: p.entry,
    stop: p.stop,
    t1: p.t1,
    t2: isFinite(p.t2) ? p.t2 : undefined,
    bracket: { stop: p.stop, takeProfit: p.t1, takeProfit2: isFinite(p.t2) ? p.t2 : undefined },
    rr1: Math.abs(p.t1 - p.entry) / Math.abs(p.entry - p.stop),
    source: 'hardgate-daemon',
  };
}

export async function runMarketScan(ctx){
  ctx = ctx || {};
  var log = ctx.log || function(){};
  var now = Date.now();
  log('[SCAN START] ' + new Date(now).toISOString());

  var brain = ctx.brainResult;
  if (!brain){
    if (typeof ctx.runBrain === 'function') brain = await ctx.runBrain();
    else return { ok: false, reason: 'no brain runner' };
  }
  if (!brain || !brain.ok){
    log('[SCAN] brain unavailable: ' + ((brain && brain.reason) || 'unknown'));
    return { ok: false, reason: (brain && brain.reason) || 'brain failed' };
  }

  var convictionManager = ctx.convictionManager;
  var db = ctx.db;
  var executor = ctx.executor;
  var dryRun = !!ctx.dryRun;
  var atr = isFinite(ctx.atr) && ctx.atr > 0 ? ctx.atr : 15;

  var executable = filterExecutableBrainRows(brain.rows);
  log('[SCAN] ' + executable.length + ' PRIME/HIGH rows with valid plans (of ' + brain.rows.length + ' total)');

  var executed = 0, merged = 0, skipped = 0;
  for (var i = 0; i < executable.length; i++){
    var row = executable[i];
    var setup = brainRowToLockSetup(row, ctx.setupType || 'scalp');
    var lockResult = convictionManager.lockConviction(setup, now, atr);

    if (lockResult.action === 'MERGED'){
      merged++;
      if (db && convictionManager.toRecord){
        var mrec = convictionManager.toRecord(lockResult.setup);
        if (mrec) db.saveConviction(mrec.id, mrec);
      }
      continue;
    }
    if (lockResult.action !== 'NEW_LOCK'){
      skipped++;
      continue;
    }

    var tradePlan = brainRowToTradePlan(row);
    if (dryRun || !executor){
      log('[DRY RUN] would execute ' + tradePlan.side + ' ' + tradePlan.sym + ' @ ' + tradePlan.entry);
      skipped++;
      continue;
    }

    var tradeResult = await executor.executeTrade(tradePlan);
    if (tradeResult && tradeResult.success){
      executed++;
      var rec = convictionManager.toRecord ? convictionManager.toRecord(lockResult.setup) : lockResult.setup;
      if (db && rec) db.saveConviction(rec.id || lockResult.setup.id, rec);
      if (db) db.saveOrder({ orderId: tradeResult.orderId, sym: tradePlan.sym, side: tradePlan.side, size: tradeResult.size });
      log('[EXEC OK] ' + tradePlan.sym + ' order ' + tradeResult.orderId);
    }else{
      convictionManager.activeConvictions.delete(lockResult.setup.id);
      if (db) db.removeConviction(lockResult.setup.id);
      log('[EXEC FAIL] ' + tradePlan.sym + ' — ' + ((tradeResult && tradeResult.error) || 'unknown'));
    }
  }

  if (typeof convictionManager.evaluateInvalidations === 'function' && ctx.currentCandle){
    var closed = convictionManager.evaluateInvalidations(
      ctx.currentCandle,
      ctx.is15mClose !== false,
      !!ctx.is4hClose,
      now,
      ctx.barIndex
    );
    if (closed && closed.length){
      for (var c = 0; c < closed.length; c++){
        if (db) db.removeConviction(closed[c].id);
        log('[LOCK CLOSED] ' + closed[c].id + ' — ' + closed[c].status);
      }
    }
  }

  return { ok: true, executed: executed, merged: merged, skipped: skipped, candidates: executable.length };
}
