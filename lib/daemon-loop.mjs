/* Pure helpers + one market-scan pass (testable without Puppeteer). */
import { evaluateActiveConvictions } from './daemon-market.mjs';
import { inferSetupTypeFromBrainRow } from './daemon-unwind.mjs';

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

  var invBefore = await evaluateActiveConvictions({
    convictionManager: convictionManager,
    db: db,
    executor: executor,
    dryRun: dryRun || !executor,
    log: log,
    barIndex: ctx.barIndex,
  });
  if (invBefore.closed) log('[SCAN] ' + invBefore.closed + ' active conviction(s) closed before new entries');

  var executed = 0, merged = 0, skipped = 0;
  for (var i = 0; i < executable.length; i++){
    var row = executable[i];
    var setup = brainRowToLockSetup(row, ctx.setupType || inferSetupTypeFromBrainRow(row));
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

    lockResult.setup.executionBarIndex = ctx.barIndex || 0;
    lockResult.setup.executionState = 'FULL_RISK_ON';

    var tradePlan = brainRowToTradePlan(row);
    if (dryRun || !executor){
      log('[DRY RUN] would execute ' + tradePlan.side + ' ' + tradePlan.sym + ' @ ' + tradePlan.entry);
      skipped++;
      continue;
    }

    var tradeResult = await executor.executeTrade(tradePlan);
    if (tradeResult && tradeResult.success){
      executed++;
      lockResult.setup.orderId = tradeResult.orderId;
      lockResult.setup.ccxtSymbol = tradeResult.symbol;
      lockResult.setup.fillSize = tradeResult.size;
      var rec = convictionManager.toRecord ? convictionManager.toRecord(lockResult.setup) : lockResult.setup;
      if (rec){
        rec.orderId = tradeResult.orderId;
        rec.ccxtSymbol = tradeResult.symbol;
        rec.fillSize = tradeResult.size;
      }
      if (db && rec) db.saveConviction(rec.id || lockResult.setup.id, rec);
      if (db) db.saveOrder({
        orderId: tradeResult.orderId,
        sym: tradePlan.sym,
        side: tradePlan.side,
        size: tradeResult.size,
        convictionId: lockResult.setup.id,
      });
      log('[EXEC OK] ' + tradePlan.sym + ' order ' + tradeResult.orderId);
    }else{
      convictionManager.activeConvictions.delete(lockResult.setup.id);
      if (db) db.removeConviction(lockResult.setup.id);
      log('[EXEC FAIL] ' + tradePlan.sym + ' — ' + ((tradeResult && tradeResult.error) || 'unknown'));
    }
  }

  var invAfter = await evaluateActiveConvictions({
    convictionManager: convictionManager,
    db: db,
    executor: executor,
    dryRun: dryRun || !executor,
    log: log,
    barIndex: ctx.barIndex,
  });
  if (invAfter.closed) log('[SCAN] ' + invAfter.closed + ' active conviction(s) closed after scan');

  return { ok: true, executed: executed, merged: merged, skipped: skipped, candidates: executable.length,
           invalidations: (invBefore.closed || 0) + (invAfter.closed || 0) };
}
