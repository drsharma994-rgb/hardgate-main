#!/usr/bin/env node
/* HARDGATE — 24/7 institutional daemon entry (app.js).
   Runs BRAIN synthesis + conviction lock + CCXT execution on a timer. */
import { StateDatabase } from './lib/daemon-state.mjs';
import { loadConvictionLockManager, hydrateConvictionManager } from './lib/daemon-conviction.mjs';
import { runBrainSynthesis } from './lib/daemon-brain.mjs';
import { runAgentSwarm } from './lib/agent-brain.mjs';
import { getAgentStateStore } from './lib/agent-state.mjs';
import { runMarketScan as executeMarketScan } from './lib/daemon-loop.mjs';
import { hgCcxtExecutorFromEnv } from './lib/hardgate-executor.mjs';

const SCAN_MS = +(process.env.HARDGATE_SCAN_MS || 15 * 60 * 1000);
const DRY_RUN = process.env.HARDGATE_DAEMON_DRY_RUN === '1' || process.env.HARDGATE_DAEMON_DRY_RUN === 'true';
const AGENT_SWARM = process.env.HARDGATE_AGENT_SWARM === '1' || process.env.HARDGATE_AGENT_SWARM === 'true';

function log(msg){
  try{ console.log(msg); }catch(e){}
}

async function bootHardgate(){
  log('==========================================');
  log(' 🦅 HARDGATE INSTITUTIONAL ENGINE v2.0 ');
  log('==========================================');

  var db = new StateDatabase();
  var activeState = await db.loadStateOnBoot();
  log('[BOOT] restored ' + (activeState.convictions ? activeState.convictions.length : 0) + ' conviction(s) from disk');

  var ConvictionLockManager = loadConvictionLockManager();
  var convictionManager = new ConvictionLockManager({ type: 'scalp', debug: process.env.HARDGATE_DAEMON_DEBUG === '1' });
  hydrateConvictionManager(convictionManager, activeState);

  var executor = hgCcxtExecutorFromEnv();
  if (!executor && !DRY_RUN){
    log('[BOOT] WARN: EXECUTE_CCXT_* not set — scans will run but orders will not fire (set HARDGATE_DAEMON_DRY_RUN=1 to silence)');
  }else if (DRY_RUN){
    log('[BOOT] DRY RUN — no live orders');
  }else{
    log('[BOOT] CCXT executor armed (' + (process.env.EXECUTE_CCXT_EXCHANGE || 'exchange') + ')');
  }

  var siteUrl = process.env.HARDGATE_URL || process.env.RENDER_EXTERNAL_URL || 'http://127.0.0.1:10000/';

  async function runMarketScan(){
    log('[SCAN START] ' + new Date().toISOString());
    try{
      var brainResult = await runBrainSynthesis(siteUrl);
      if (AGENT_SWARM){
        log('[AGENT SWARM] starting headless workforce scan…');
        var agentStore = getAgentStateStore();
        agentStore.load();
        agentStore.setSwarmBusy(true);
        var swarmResult = await runAgentSwarm(siteUrl);
        if (swarmResult && swarmResult.ok){
          agentStore.recordSwarmResult(swarmResult);
          log('[AGENT SWARM] ok · score ' + (swarmResult.desk && swarmResult.desk.swarmScore != null ? swarmResult.desk.swarmScore : '—'));
        } else {
          agentStore.setSwarmBusy(false);
          log('[AGENT SWARM] skipped/failed: ' + ((swarmResult && swarmResult.reason) || 'unknown'));
        }
      }
      return await executeMarketScan({
        brainResult: brainResult,
        convictionManager: convictionManager,
        db: db,
        executor: executor,
        dryRun: DRY_RUN || !executor,
        atr: +(process.env.HARDGATE_DAEMON_ATR || 15),
        log: log,
      });
    }catch(error){
      log('[FATAL LOOP ERROR] ' + ((error && error.message) || error));
      return { ok: false };
    }
  }

  log('[BOOT] scan interval ' + (SCAN_MS / 60000) + ' min · site ' + siteUrl + (AGENT_SWARM ? ' · agent swarm ON' : ''));
  setInterval(runMarketScan, SCAN_MS);
  await runMarketScan();
}

bootHardgate().catch(function(e){
  console.error('[BOOT FAILED]', e && e.message ? e.message : e);
  process.exit(1);
});
