#!/usr/bin/env node
/* HARDGATE — 24/7 institutional daemon entry (app.js).
   Runs BRAIN synthesis + conviction lock + CCXT execution on a timer. */
import { StateDatabase } from './lib/daemon-state.mjs';
import { loadConvictionLockManager, hydrateConvictionManager } from './lib/daemon-conviction.mjs';
import { runBrainSynthesis } from './lib/daemon-brain.mjs';
import { runMarketScan } from './lib/daemon-loop.mjs';
import { hgCcxtExecutorFromEnv } from './lib/hardgate-executor.mjs';

const SCAN_MS = +(process.env.HARDGATE_SCAN_MS || 15 * 60 * 1000);
const DRY_RUN = process.env.HARDGATE_DAEMON_DRY_RUN === '1' || process.env.HARDGATE_DAEMON_DRY_RUN === 'true';

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

  async function tick(){
    try{
      var brainResult = await runBrainSynthesis(siteUrl);
      await runMarketScan({
        brainResult: brainResult,
        convictionManager: convictionManager,
        db: db,
        executor: executor,
        dryRun: DRY_RUN || !executor,
        atr: +(process.env.HARDGATE_DAEMON_ATR || 15),
        log: log,
      });
    }catch(err){
      log('[FATAL LOOP ERROR] ' + ((err && err.message) || err));
    }
  }

  log('[BOOT] scan interval ' + (SCAN_MS / 60000) + ' min · site ' + siteUrl);
  setInterval(tick, SCAN_MS);
  await tick();
}

bootHardgate().catch(function(e){
  console.error('[BOOT FAILED]', e && e.message ? e.message : e);
  process.exit(1);
});
