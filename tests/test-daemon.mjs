/* HARDGATE — daemon unit tests (no puppeteer / ccxt required). */
import { StateDatabase } from '../lib/daemon-state.mjs';
import { filterExecutableBrainRows, brainRowToLockSetup, brainRowToTradePlan, runMarketScan } from '../lib/daemon-loop.mjs';
import { cooldownCheck } from '../lib/cooldown.mjs';
import { brainLiveEligibleRow, filterDaemonBrainRows } from '../lib/brain-robust.mjs';
import { symToBinanceKlineSymbol, evaluateActiveConvictions } from '../lib/daemon-market.mjs';
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

console.log('== cooldown gate ==');
{
  var now = Date.now();
  var outs = [
    { sym: 'BTCUSDT', r: -1, closedAt: now - 3e6 },
    { sym: 'BTCUSDT', r: -1, closedAt: now - 1e6 },
  ];
  var rows = [
    { sym: 'BTCUSDT', dir: 'long', tier: 'PRIME', plan: { entry: 100, stop: 95, t1: 110 } },
    { sym: 'ETHUSDT', dir: 'long', tier: 'PRIME', plan: { entry: 50, stop: 48, t1: 55 } },
  ];
  var blocked = filterExecutableBrainRows(rows, undefined, { outcomes: outs, nowMs: now });
  ok(blocked.length === 1 && blocked[0].sym === 'ETHUSDT', 'symbol in cooldown skipped');
  ok(cooldownCheck('BTCUSDT', outs, null, now).blocked === true, 'cooldownCheck blocks BTC');
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

console.log('== brain live eligibility ==');
{
  var primeOk = { tier: 'PRIME', dir: 'long', plan: { entry: 100, stop: 95, t1: 110 }, liveOk: true };
  var elOk = brainLiveEligibleRow(primeOk);
  ok(elOk.ok, 'PRIME + liveOk passes brainLiveEligibleRow');

  var primeBadLive = { tier: 'PRIME', dir: 'long', plan: { entry: 100, stop: 95, t1: 110 },
    liveOk: false, liveReasons: ['spread too wide'] };
  var elBad = brainLiveEligibleRow(primeBadLive);
  ok(!elBad.ok && elBad.reasons.indexOf('spread too wide') >= 0, 'liveOk false merges liveReasons');

  var highRow = { tier: 'HIGH', dir: 'long', plan: { entry: 100, stop: 95, t1: 110 }, liveOk: true };
  ok(!brainLiveEligibleRow(highRow).ok, 'non-PRIME tier rejected in live eligibility');

  var batch = [
    primeOk,
    primeBadLive,
    { sym: 'ETHUSDT', tier: 'PRIME', dir: 'short', plan: { entry: 50, stop: 52, t1: 46 }, liveOk: true },
    { sym: 'SOLUSDT', tier: 'HIGH', dir: 'long', plan: { entry: 20, stop: 19, t1: 22 }, liveOk: true },
  ];
  var liveFiltered = filterDaemonBrainRows(batch, { liveMode: true, tiers: ['PRIME'] });
  ok(liveFiltered.length === 2, 'liveMode keeps PRIME rows with liveOk true only');

  var prevLive = process.env.HARDGATE_BRAIN_LIVE;
  process.env.HARDGATE_BRAIN_LIVE = '1';
  var execLive = filterExecutableBrainRows(batch);
  ok(execLive.length === 2 && execLive.every(function(r){ return r.tier === 'PRIME'; }),
    'filterExecutableBrainRows honors HARDGATE_BRAIN_LIVE=1');
  delete process.env.HARDGATE_BRAIN_LIVE;
  var execDefault = filterExecutableBrainRows(batch);
  ok(execDefault.length === 4, 'default filter allows PRIME + HIGH without live gate');
  if (prevLive === undefined) delete process.env.HARDGATE_BRAIN_LIVE;
  else process.env.HARDGATE_BRAIN_LIVE = prevLive;
}

console.log('== brainRowToTradePlan ==');
{
  var plan = brainRowToTradePlan({
    sym: 'BTCUSDT', dir: 'long',
    plan: { entry: 100, stop: 95, t1: 110, t2: 120 },
  });
  ok(plan.source === 'hardgate-daemon' && plan.bracket.stop === 95 && plan.bracket.takeProfit === 110,
    'brainRowToTradePlan maps bracket + source');
  ok(Math.abs(plan.rr1 - 2) < 1e-9, 'brainRowToTradePlan computes rr1');
}

console.log('== runMarketScan brain unavailable ==');
{
  var res = await runMarketScan({ log: function(){} });
  ok(res.ok === false && res.reason === 'no brain runner', 'missing brain runner fails fast');
  var bad = await runMarketScan({
    brainResult: { ok: false, reason: 'puppeteer missing' },
    log: function(){},
  });
  ok(bad.ok === false && bad.reason === 'puppeteer missing', 'brain ok:false propagates reason');
}

console.log('== runMarketScan live execute + db persist ==');
{
  var Mgr4 = loadConvictionLockManager();
  var mgr4 = new Mgr4({ type: 'scalp' });
  var trades = [];
  var saved = [];
  var db4 = {
    saveConviction(id, rec){ saved.push({ id: id, rec: rec }); },
    saveOrder(o){ saved.push({ order: o }); },
    removeConviction(){},
  };
  var exec4 = {
    executeTrade: async function(tp){
      trades.push(tp);
      return { success: true, orderId: 'ord-live-1', symbol: 'BTC/USDT:USDT', size: 0.02 };
    },
  };
  var live = await runMarketScan({
    dryRun: false,
    convictionManager: mgr4,
    executor: exec4,
    db: db4,
    brainResult: {
      ok: true,
      rows: [{ sym: 'BTCUSDT', dir: 'long', tier: 'PRIME',
        plan: { entry: 100, stop: 95, t1: 110 }, evidence: ['a'] }],
    },
    log: function(){},
  });
  ok(live.ok && live.executed === 1 && live.skipped === 0, 'live scan executes PRIME row');
  ok(trades.length === 1 && trades[0].sym === 'BTCUSDT', 'executor receives trade plan');
  ok(mgr4.activeConvictions.size === 1, 'conviction remains after successful fill');
  ok(saved.some(function(s){ return s.order && s.order.orderId === 'ord-live-1'; }), 'db.saveOrder called');
}

console.log('== runMarketScan exec fail rolls back lock ==');
{
  var Mgr5 = loadConvictionLockManager();
  var mgr5 = new Mgr5({ type: 'scalp' });
  var removed = [];
  var db5 = {
    saveConviction(){},
    removeConviction(id){ removed.push(id); },
  };
  var fail = await runMarketScan({
    dryRun: false,
    convictionManager: mgr5,
    executor: { executeTrade: async () => ({ success: false, error: 'margin' }) },
    db: db5,
    brainResult: {
      ok: true,
      rows: [{ sym: 'ETHUSDT', dir: 'short', tier: 'HIGH',
        plan: { entry: 50, stop: 52, t1: 46 }, evidence: [] }],
    },
    log: function(){},
  });
  ok(fail.executed === 0 && fail.candidates === 1, 'failed execute leaves executed at 0');
  ok(mgr5.activeConvictions.size === 0, 'failed execute removes active conviction');
  ok(removed.length === 1, 'db.removeConviction on exec fail');
}

console.log('== runMarketScan merge duplicate anchor ==');
{
  var Mgr6 = loadConvictionLockManager();
  var mgr6 = new Mgr6({ type: 'scalp' });
  var row = { sym: 'BTCUSDT', dir: 'long', tier: 'PRIME',
    plan: { entry: 100, stop: 95, t1: 110 }, evidence: ['x'] };
  var merged = await runMarketScan({
    dryRun: true,
    convictionManager: mgr6,
    brainResult: { ok: true, rows: [row, row] },
    log: function(){},
  });
  ok(merged.merged === 1 && merged.skipped === 1, 'duplicate row merges then dry-skips second pass');
}

console.log('== evaluateActiveConvictions invalidation ==');
{
  var Mgr7 = loadConvictionLockManager();
  var mgr7 = new Mgr7({ type: 'scalp' });
  var setup7 = brainRowToLockSetup({
    sym: 'BTCUSDT', dir: 'long', tier: 'PRIME',
    plan: { entry: 100, stop: 95, t1: 110 }, evidence: [],
  }, 'scalp');
  mgr7.lockConviction(setup7, Date.now(), 15);
  var t15 = Math.floor(Date.UTC(2024, 5, 15, 12, 0, 0) / 1000);
  var closed = await evaluateActiveConvictions({
    convictionManager: mgr7,
    currentCandle: { t: t15, o: 100, h: 101, l: 94, c: 94.5, v: 1 },
    dryRun: true,
    executor: { cancelOrder: async () => ({ success: true }) },
    log: function(){},
  });
  ok(closed.closed === 1 && mgr7.activeConvictions.size === 0, 'stop hit closes active conviction');
}

console.log('\n' + pass + ' assertions passed');
