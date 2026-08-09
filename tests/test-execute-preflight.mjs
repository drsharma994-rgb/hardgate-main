/* HARDGATE — execute preflight + CCXT desk panel tests (offline). */
import { hgPrepareExecutePayload, hgExecutePreflightFlags, hgReleaseExecuteBudget } from '../lib/execute-preflight.mjs';
import { hgBudgetSessionReset } from '../lib/budget-session.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

console.log('== execute preflight flags ==');
{
  ok(hgExecutePreflightFlags({ EXECUTE_VWAP_SIZING: '0' }).vwap === false, 'vwap off via env');
  ok(hgExecutePreflightFlags({ EXECUTE_BUDGET_CHECK: '0' }).budget === false, 'budget off via env');
  ok(hgExecutePreflightFlags({}).vwap === true, 'vwap default on');
}

console.log('== budget reserve blocks over-allocation ==');
{
  hgBudgetSessionReset();
  var mockExec = null;
  var pre = await hgPrepareExecutePayload(mockExec, {
    symbol: 'BTCUSDT', side: 'long', qty: 0.4, entry: 100000, stop: 99000, t1: 101000,
  }, { env: { EXECUTE_VWAP_SIZING: '0', EXECUTE_BUDGET_CHECK: '1', EXECUTE_NAV_USD: '50000' } });
  ok(pre.ok && pre.budgetLockId, 'first reserve ok');
  var pre2 = await hgPrepareExecutePayload(mockExec, {
    symbol: 'ETHUSDT', side: 'long', qty: 4, entry: 4000, stop: 3900, t1: 4100,
  }, { env: { EXECUTE_VWAP_SIZING: '0', EXECUTE_BUDGET_CHECK: '1', EXECUTE_NAV_USD: '50000' } });
  ok(!pre2.ok && /budget exceeded/i.test(pre2.reason || ''), 'second reserve over nav blocked');
  hgReleaseExecuteBudget(pre.budgetLockId);
  hgReleaseExecuteBudget(pre2.budgetLockId);
}

console.log('== vwap clip reduces qty on shallow book ==');
{
  hgBudgetSessionReset();
  var mockExec = {
    init: async function(){
      return {
        markets: { 'BTC/USDT:USDT': {} },
        fetchOrderBook: async function(){
          return { bids: [[99900, 0.01]], asks: [[100000, 0.02], [100050, 0.5]] };
        },
      };
    },
  };
  var preV = await hgPrepareExecutePayload(mockExec, {
    sym: 'BTC/USDT:USDT', side: 'long', qty: 1, entry: 100000, stop: 99000, t1: 101000,
  }, { env: { EXECUTE_VWAP_SIZING: '1', EXECUTE_BUDGET_CHECK: '0', EXECUTE_VWAP_MAX_SPREAD_BPS: '25' } });
  ok(preV.ok && preV.payload.qty < 1, 'vwap clips qty below request');
  hgReleaseExecuteBudget(preV.budgetLockId);
}

console.log('== ccxt desk panel wiring ==');
{
  var deskJs = fs.readFileSync(path.join(root, 'ccxt-desk.js'), 'utf8');
  ok(/hgCcxtDeskPanelHtml/.test(deskJs), 'ccxt desk panel export');
  ok(/Funding arb/.test(deskJs), 'funding arb readout in panel');
  var instr = fs.readFileSync(path.join(root, 'formation-instr-ui.js'), 'utf8');
  ok(instr.indexOf('hgCcxtDeskPanelHtml') >= 0, 'formation instr mounts ccxt panel');
  ok(/hgPrepareExecutePayload/.test(fs.readFileSync(path.join(root, 'lib/execute-api.mjs'), 'utf8')),
    'execute-api calls preflight');
}

console.log('\n' + pass + ' assertions passed');
