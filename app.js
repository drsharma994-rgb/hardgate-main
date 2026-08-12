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

/* =========================================================================
   OWNER DECISION — the daemon may NOT route a real order.

   This build is a signal + paper-measurement terminal. Orders are placed BY
   HAND on Delta. execute.js has carried HG_LIVE_TRADING_ENABLED = false for
   the browser path, guarded by tests/test-no-live-trading.mjs — but that guard
   only ever covered execute.js. The daemon was a SECOND, UNGUARDED execution
   route: setting EXECUTE_CCXT_* on the Render worker and leaving
   HARDGATE_DAEMON_DRY_RUN unset was enough to arm live orders, and render.yaml
   documented exactly that as a supported setup step.

   The worker still earns its keep: BRAIN synthesis, the conviction lock, the
   agent swarm and Telegram alerts all run untouched. Only the broker call is
   removed. hgCcxtExecutorFromEnv() is never invoked, so no API key is ever
   read and nothing can reach an exchange regardless of environment, and
   dryRun is forced true rather than derived from config.

   To re-arm you must edit THIS LINE in source. That is deliberate: it cannot
   be done from a Render dashboard, an env var, or a blueprint apply.
   ========================================================================= */
const HG_DAEMON_EXECUTION_ENABLED = false;

const SCAN_MS = +(process.env.HARDGATE_SCAN_MS || 15 * 60 * 1000);
/* Kept for logging only. It can no longer weaken anything: dryRun below is
   hard-true while HG_DAEMON_EXECUTION_ENABLED is false. */
const DRY_RUN = process.env.HARDGATE_DAEMON_DRY_RUN === '1' || process.env.HARDGATE_DAEMON_DRY_RUN === 'true';
const AGENT_SWARM = (function(){
  if (process.env.HARDGATE_AGENT_SWARM === '0' || process.env.HARDGATE_AGENT_SWARM === 'false') return false;
  if (process.env.HARDGATE_AGENT_SWARM === '1' || process.env.HARDGATE_AGENT_SWARM === 'true') return true;
  return !!(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID);
})();

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

  /* Never even construct the executor while execution is disabled — no key is
     read, no exchange client exists, nothing to pass accidentally downstream. */
  var executor = HG_DAEMON_EXECUTION_ENABLED ? hgCcxtExecutorFromEnv() : null;
  if (!HG_DAEMON_EXECUTION_ENABLED){
    /* The phrase "DRY RUN" is kept deliberately: tests/test-app-boot.mjs
       asserts the daemon acknowledges it will not trade, and that intent still
       holds here — more strongly than before, since this state cannot be
       switched off from the environment at all. */
    log('[BOOT] DRY RUN — LIVE EXECUTION DISABLED IN SOURCE (owner decision) — signal + paper only.');
    log('[BOOT] BRAIN synthesis, conviction lock, agent swarm and alerts all run. No broker call is possible.');
    if (process.env.EXECUTE_CCXT_KEY || process.env.EXECUTE_CCXT_SECRET || process.env.EXECUTE_CCXT_EXCHANGE){
      log('[BOOT] NOTE: EXECUTE_CCXT_* is set in the environment but IGNORED. Remove it to avoid confusion.');
    }
  }else if (!executor){
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
        /* Hard-true while execution is disabled in source. Not derived from
           env, so no dashboard change can flip it. */
        dryRun: !HG_DAEMON_EXECUTION_ENABLED || DRY_RUN || !executor,
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
