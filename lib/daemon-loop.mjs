/* Pure helpers + one market-scan pass (testable without Puppeteer). */
import { evaluateActiveConvictions } from './daemon-market.mjs';
import { inferSetupTypeFromBrainRow } from './daemon-unwind.mjs';
import { filterDaemonBrainRows } from './brain-robust.mjs';
import { cooldownCheck, cooldownCfgFromEnv } from './cooldown.mjs';
import {
  brainRowToCandidate,
  processFormationCandidates,
  attachFingerprint,
  ledgerClosedRows,
  formationCfgFromEnv,
  fqsLine,
} from './formation-instr.mjs';
import { createGateRecorder } from './gate-attrib.mjs';
import { shadowPush } from './shadow-book.mjs';

export function filterExecutableBrainRows(rows, tiers, ctx){
  ctx = ctx || {};
  var outcomes = Array.isArray(ctx.outcomes) ? ctx.outcomes : [];
  var cdCfg = cooldownCfgFromEnv(process.env);
  var now = isFinite(+ctx.nowMs) ? +ctx.nowMs : Date.now();
  var liveMode = process.env.HARDGATE_BRAIN_LIVE === '1' || process.env.HARDGATE_BRAIN_LIVE === 'true';
  var gates = ctx.gates || null;
  if (liveMode){
    return filterDaemonBrainRows(rows, { liveMode: true, tiers: tiers || ['PRIME'] })
      .filter(function(r){
        var cd = cooldownCheck(r.sym, outcomes, cdCfg, now);
        if (gates) gates.record('cooldown', !cd.blocked, { symbol: r.sym, reason: cd.reason });
        if (cd.blocked && ctx.onSkip) ctx.onSkip(r.sym, cd.reason, 'cooldown');
        return !cd.blocked;
      });
  }
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
    var cd = cooldownCheck(row.sym, outcomes, cdCfg, now);
    if (gates) gates.record('cooldown', !cd.blocked, { symbol: row.sym, reason: cd.reason });
    if (cd.blocked){
      if (ctx.onSkip) ctx.onSkip(row.sym, cd.reason, 'cooldown');
      continue;
    }
    out.push(row);
  }
  return out;
}

export function brainRowToLockSetup(row, setupType){
  setupType = setupType || 'scalp';
  var p = row.plan;
  var anchor = isFinite(p.entry) ? p.entry : NaN;
  var cand = brainRowToCandidate(row) || {};
  var fp = attachFingerprint({}, cand);
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
    fpKey: fp.key,
    fpParts: fp.parts,
    fqs: row.fqs != null ? row.fqs : cand.fqs,
    fqsGrade: row.fqsGrade || cand.fqsGrade,
    sizeMult: row.sizeMult != null ? row.sizeMult : 1,
  };
}

export function brainRowToTradePlan(row){
  var p = row.plan;
  var cand = brainRowToCandidate(row) || {};
  var fp = attachFingerprint({}, cand);
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
    fpKey: fp.key,
    fpParts: fp.parts,
    fqs: row.fqs != null ? row.fqs : cand.fqs,
    fqsGrade: row.fqsGrade || cand.fqsGrade,
    fqsLine: fqsLine(Object.assign({}, cand, row)),
    sizeMult: row.sizeMult != null ? row.sizeMult : 1,
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
  var gates = ctx.gates || createGateRecorder();
  var outcomes = db && typeof db.recentOutcomes === 'function' ? db.recentOutcomes(100) : [];
  var ledgerRows = ledgerClosedRows(null, outcomes);

  var executableRows = filterExecutableBrainRows(brain.rows, undefined, {
    outcomes: outcomes,
    gates: gates,
    onSkip: function(sym, reason, gate){
      log('[GATE ' + (gate || 'skip') + '] ' + sym + ' — ' + reason);
    },
  });

  var candidates = [];
  for (var c = 0; c < executableRows.length; c++){
    var cand = brainRowToCandidate(executableRows[c]);
    if (cand) candidates.push(cand);
  }

  var formed = processFormationCandidates(candidates, {
    ledgerRows: ledgerRows,
    gates: gates,
    env: process.env,
    onSkip: function(cand, reason, gate){
      log('[GATE ' + gate + '] ' + (cand.sym || cand.symbol) + ' — ' + reason);
      shadowPush({ symbol: cand.sym || cand.symbol, side: cand.side, entry: cand.entry,
        stop: cand.stop, target: cand.t1, vetoGate: gate, ts: now, fpKey: cand.fpKey });
    },
  });

  var ranked = formed.passed;
  for (var r = 0; r < ranked.length; r++){
    if (ranked[r]._row){
      ranked[r]._row.fqs = ranked[r].fqs;
      ranked[r]._row.fqsGrade = ranked[r].fqsGrade;
      ranked[r]._row.fpKey = ranked[r].fpKey;
      ranked[r]._row.sizeMult = ranked[r].sizeMult;
    }
  }
  var executable = ranked.map(function(c){ return c._row; }).filter(Boolean);

  log('[SCAN] ' + executable.length + ' formation-ranked rows (of ' + brain.rows.length
    + ' total, ' + formed.skipped + ' gated by FQS/edge)');
  if (executable.length && executable[0].fqs != null){
    log('[FQS top] ' + executable[0].sym + ' ' + executable[0].fqsGrade + ' ' + executable[0].fqs);
  }

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
  var freshLocks = new Set();
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
    lockResult.setup.maxBarsToTp1 = (ctx.setupType === 'swing') ? 12 : 24;
    lockResult.setup.stratKey = 'brain';

    var tradePlan = brainRowToTradePlan(row);
    if (dryRun || !executor){
      log('[DRY RUN] would execute ' + tradePlan.side + ' ' + tradePlan.sym + ' @ ' + tradePlan.entry
        + (tradePlan.fqsLine ? ' · ' + tradePlan.fqsLine : ''));
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
      freshLocks.add(lockResult.setup.id);
      log('[EXEC OK] ' + tradePlan.sym + ' order ' + tradeResult.orderId
        + (tradePlan.fqsGrade ? ' · FQS ' + tradePlan.fqsGrade + ' ' + tradePlan.fqs : ''));
    }else{
      convictionManager.activeConvictions.delete(lockResult.setup.id);
      if (db) db.removeConviction(lockResult.setup.id);
      log('[EXEC FAIL] ' + tradePlan.sym + ' — ' + ((tradeResult && tradeResult.error) || 'unknown'));
    }
  }

  var invAfter = await evaluateActiveConvictions({
    excludeIds: freshLocks,
    convictionManager: convictionManager,
    db: db,
    executor: executor,
    dryRun: dryRun || !executor,
    log: log,
    barIndex: ctx.barIndex,
  });
  if (invAfter.closed) log('[SCAN] ' + invAfter.closed + ' active conviction(s) closed after scan');

  var gateSummary = gates.summary();
  if (gateSummary.rows.length) log('[GATES] ' + gateSummary.rows.map(function(g){
    return g.gate + ' veto ' + g.vetoRate + '%';
  }).join(' · '));

  return {
    ok: true, executed: executed, merged: merged, skipped: skipped,
    candidates: executable.length, formationSkipped: formed.skipped,
    gates: gateSummary, invalidations: (invBefore.closed || 0) + (invAfter.closed || 0),
  };
}

export { formationCfgFromEnv, processFormationCandidates, createGateRecorder };
