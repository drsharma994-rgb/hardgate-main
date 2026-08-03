/* HARDGATE — hardgate-executor.mjs unit tests (no live keys). */
import { hgCalculateOrderSize, hgNormalizeCcxtSymbol, hgCcxtExecutorFromEnv } from '../lib/hardgate-executor.mjs';
import { hgBuildBracketPayload, hgExecuteCcxtConfigured } from '../lib/execute-core.mjs';
import { executeCapabilities } from '../lib/execute-api.mjs';

let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

console.log('== order sizing ==');
{
  var s = hgCalculateOrderSize(10000, 2650, 2640, 1);
  ok(s.positionSizeUnits === 10, '1% of $10k with $10 stop distance -> 10 units');
  ok(hgCalculateOrderSize(10000, 100, 100).error, 'zero SL distance -> error');
}

console.log('== symbol normalization ==');
{
  var markets = { 'BTC/USDT:USDT': {}, 'PAXG/USDT:USDT': {} };
  ok(hgNormalizeCcxtSymbol('B-BTC_USDT', markets) === 'BTC/USDT:USDT', 'Delta sym -> linear USDT swap');
  ok(hgNormalizeCcxtSymbol('PAXGUSDT', markets) === 'PAXG/USDT:USDT', 'PAXGUSDT -> PAXG/USDT:USDT');
}

console.log('== bracket payload entry passthrough ==');
{
  var p = hgBuildBracketPayload({ sym: 'PAXGUSDT', side: 'long', qty: 1, stop: 2640, t1: 2660, entry: 2650 });
  ok(p && p.entry === 2650, 'build payload preserves limit entry for CCXT');
}

console.log('== CCXT env capabilities ==');
{
  var prevEx = process.env.EXECUTE_CCXT_EXCHANGE;
  var prevKey = process.env.EXECUTE_CCXT_API_KEY;
  var prevSec = process.env.EXECUTE_CCXT_SECRET;
  delete process.env.EXECUTE_BACKEND_URL;
  delete process.env.EXECUTE_WEBHOOK_URL;
  process.env.EXECUTE_CCXT_EXCHANGE = 'bybit';
  process.env.EXECUTE_CCXT_API_KEY = 'test-key';
  process.env.EXECUTE_CCXT_SECRET = 'test-secret';
  ok(hgExecuteCcxtConfigured(), 'CCXT configured when exchange + key + secret set');
  var caps = executeCapabilities();
  ok(caps.ready && caps.mode === 'ccxt' && caps.ccxt.exchange === 'bybit', 'capabilities report ccxt mode');
  ok(hgCcxtExecutorFromEnv() instanceof Object, 'executor singleton constructs from env');
  if (prevEx) process.env.EXECUTE_CCXT_EXCHANGE = prevEx; else delete process.env.EXECUTE_CCXT_EXCHANGE;
  if (prevKey) process.env.EXECUTE_CCXT_API_KEY = prevKey; else delete process.env.EXECUTE_CCXT_API_KEY;
  if (prevSec) process.env.EXECUTE_CCXT_SECRET = prevSec; else delete process.env.EXECUTE_CCXT_SECRET;
}

console.log('\n' + pass + ' assertions passed');
