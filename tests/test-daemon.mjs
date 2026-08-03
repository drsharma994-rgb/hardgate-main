/* HARDGATE — daemon unit tests (no puppeteer / ccxt required). */
import { StateDatabase } from '../lib/daemon-state.mjs';
import { filterExecutableBrainRows, brainRowToLockSetup, runMarketScan } from '../lib/daemon-loop.mjs';
import { symToBinanceKlineSymbol } from '../lib/daemon-market.mjs';
import { convictionUnwindAction, inferSetupTypeFromBrainRow, unwindConvictionOnExchange } from '../lib/daemon-unwind.mjs';
import { loadConvictionLockManager, hydrateConvictionManager } from '../lib/daemon-conviction.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

console.log('== filter executable rows ==');
{
  var rows = [
    { sym: 'BTCUSDT', dir: 'long', tier: 'PRIME', plan: { entry: 100, stop: 95, t1: 110 } },
    { sym: 'ETHUSDT', dir: 'short', tier: 'WATCH', plan: { entry: 50, stop: 52, t1: 46 } },
    { sym: 'SOLUSDT', dir: 'long', tier: 'HIGH', plan: null },
  ];
  var ex = filterExecutableBrainRows(rows);
  ok(ex.length === 1 && ex[0].sym === 'BTCUSDT', 'only PRIME/HIGH with valid plans pass');
}

console.log('== conviction lock integration ==');
{
  var Mgr = loadConvictionLockManager();
  var mgr = new Mgr({ type: 'scalp' });
  var setup = brainRowToLockSetup({ sym: 'BTCUSDT', dir: 'long', tier: 'PRIME',
    plan: { entry: 100, stop: 95, t1: 110 }, evidence: ['a','b'] });
  var lock1 = mgr.lockConviction(setup, Date.now(), 15);
  ok(lock1.action === 'NEW_LOCK', 'first lock -> NEW_LOCK');
  var lock2 = mgr.lockConviction(setup, Date.now(), 15);
  ok(lock2.action === 'MERGED', 'duplicate anchor -> MERGED');
}

console.log('== state database ==');
{
  var tmp = path.join(os.tmpdir(), 'hg-daemon-test-' + Date.now() + '.json');
  var db = new StateDatabase(tmp);
  await db.loadStateOnBoot();
  db.saveConviction('test|long|100', { id: 'test|long|100', dir: 'long', entry: 100 });
  ok(fs.existsSync(tmp), 'state file written');
  var db2 = new StateDatabase(tmp);
  await db2.loadStateOnBoot();
  ok(db2.state.convictions.length === 1, 'state reloads convictions');
  fs.unlinkSync(tmp);
}

console.log('== dry-run market scan ==');
{
  var Mgr2 = loadConvictionLockManager();
  var mgr2 = new Mgr2({ type: 'scalp' });
  var fakeExec = { executeTrade: async () => ({ success: true, orderId: 'x1', size: 1 }) };
  var res = await runMarketScan({
    dryRun: true,
    convictionManager: mgr2,
    brainResult: {
      ok: true,
      rows: [{ sym: 'BTCUSDT', dir: 'long', tier: 'PRIME', plan: { entry: 100, stop: 95, t1: 110 }, evidence: [] }],
    },
    executor: fakeExec,
    log: function(){},
  });
  ok(res.ok && res.executed === 0 && res.skipped === 1, 'dry run skips live execute');
}

console.log('== symbol map ==');
{
  ok(symToBinanceKlineSymbol('B-BTC_USDT') === 'BTCUSDT', 'Delta sym maps to Binance kline symbol');
}

console.log('== unwind routing ==');
{
  ok(convictionUnwindAction('EXPIRED') === 'cancel_entry', 'EXPIRED cancels entry');
  ok(convictionUnwindAction('MOMENTUM DECAY') === 'close_position', 'momentum decay closes');
  ok(convictionUnwindAction('TARGET HIT') === 'noop', 'target hit noop');
  ok(inferSetupTypeFromBrainRow({ plan: { type: 'swing', entry: 1, stop: 2, t1: 3 } }) === 'swing', 'plan.type swing');
  ok(inferSetupTypeFromBrainRow({ evidence: ['TREND4H: bullish'], plan: { entry: 1, stop: 2, t1: 3 } }) === 'swing', '4H evidence -> swing');
}

console.log('== unwind dry run ==');
{
  var calls = [];
  var fake = {
    cancelOrder: async function(){ calls.push('cancel'); return { success: true }; },
    closePosition: async function(){ calls.push('close'); return { success: true }; },
  };
  await unwindConvictionOnExchange(
    { id: 'x', sym: 'BTCUSDT', orderId: 'o1', dir: 'long' },
    'EXPIRED', fake, { log: function(){} });
  ok(calls.length === 1 && calls[0] === 'cancel', 'EXPIRED triggers cancelOrder');
  calls = [];
  await unwindConvictionOnExchange(
    { id: 'y', sym: 'BTCUSDT', dir: 'long', fillSize: 1 },
    'MOMENTUM DECAY', fake, { log: function(){} });
  ok(calls.length === 1 && calls[0] === 'close', 'MOMENTUM DECAY triggers closePosition');
}

console.log('== hydrate order metadata ==');
{
  var Mgr3 = loadConvictionLockManager();
  var mgr3 = new Mgr3({ type: 'scalp' });
  hydrateConvictionManager(mgr3, {
    convictions: [{
      id: 'brain|long|100|BTCUSDT', dir: 'long', type: 'scalp',
      entry: 100, stop: 95, t1: 110, sym: 'BTCUSDT',
      orderId: 'ord-99', ccxtSymbol: 'BTC/USDT:USDT', fillSize: 0.5,
    }],
  });
  var h = mgr3.activeConvictions.get('brain|long|100|BTCUSDT');
  ok(h && h.orderId === 'ord-99' && h.fillSize === 0.5, 'hydrate restores CCXT metadata');
}

console.log('\n' + pass + ' assertions passed');
