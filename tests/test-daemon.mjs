/* HARDGATE — daemon unit tests (no puppeteer / ccxt required). */
import { StateDatabase } from '../lib/daemon-state.mjs';
import { filterExecutableBrainRows, brainRowToLockSetup, runMarketScan } from '../lib/daemon-loop.mjs';
import { loadConvictionLockManager } from '../lib/daemon-conviction.mjs';
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

console.log('\n' + pass + ' assertions passed');
