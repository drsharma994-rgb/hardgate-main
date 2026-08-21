/* HARDGATE — unified trading-stack status (ccxt / freqtrade / OpenBB / XM patterns). */
import { openbbCapabilities } from './openbb-api.mjs';
import { ccxtCapabilities } from './ccxt-market-api.mjs';
import { executeCapabilities } from './execute-api.mjs';
import { xmTraderStatus } from './xm-trader-fetch.mjs';
import { ogXmBotStatus } from './omnigold-xm-bot.mjs';
import { ftCfgFromEnv } from './freqtrade-formation.mjs';

/** Reference repos HARDGATE ports concepts from (not full forks). */
export const TRADING_STACK_REPOS = [
  {
    id: 'ccxt',
    repo: 'ccxt/ccxt',
    role: 'Public market desk + in-process execution (/api/ccxt/desk, /api/execute)',
  },
  {
    id: 'freqtrade',
    repo: 'freqtrade/freqtrade',
    role: 'Expectancy edge + cooldown/stoploss protections on formation pipeline',
  },
  {
    id: 'openbb',
    repo: 'OpenBB-finance/OpenBB',
    role: 'Macro desk for formation boost (Yahoo fallback when backend unset)',
  },
  {
    id: 'xm',
    role: 'Broker-aligned XAUUSD via MT5 REST bridge (/api/xm/candles, OMNIGOLD /api/xm/order)',
    repo: 'MetaTrader5 + custom bridge',
  },
];

function envFlag(env, key){
  return env[key] === '1' || env[key] === 'true';
}

export function tradingStackStatus(env){
  env = env || process.env;
  var ft = ftCfgFromEnv(env);
  var exec = executeCapabilities();
  var ccxt = ccxtCapabilities();
  var obb = openbbCapabilities();
  var xm = xmTraderStatus();
  xm.bot = ogXmBotStatus(env);
  var halt = envFlag(env, 'HARDGATE_KILL_SWITCH') || envFlag(env, 'HARDGATE_TRADING_HALT');
  var dryRun = envFlag(env, 'HARDGATE_DAEMON_DRY_RUN');
  return {
    ok: true,
    at: Date.now(),
    repos: TRADING_STACK_REPOS,
    ccxt: ccxt,
    openbb: obb,
    execute: exec,
    xm: xm,
    freqtrade: {
      edgeGate: ft.edgeGate,
      protectGate: ft.protectGate,
      minExpectancy: ft.minExpectancy,
      minTrades: ft.minTrades,
      cooldownMinutes: ft.cooldownMinutes,
      stoplossTradeLimit: ft.stoplossTradeLimit,
      stoplossLookbackMin: ft.stoplossLookbackMin,
    },
    gates: {
      fqs: envFlag(env, 'HARDGATE_FQS_GATE'),
      edge: envFlag(env, 'HARDGATE_EDGE_GATE'),
      ftEdge: ft.edgeGate,
      ftProtect: ft.protectGate,
    },
    halt: halt,
    dryRun: dryRun,
    routes: {
      status: '/api/trading-stack/status',
      ccxtDesk: ccxt.deskRoute,
      openbbDesk: obb.deskRoute,
      executeCaps: '/api/execute/capabilities',
      xmStatus: '/api/xm/status',
    },
  };
}
