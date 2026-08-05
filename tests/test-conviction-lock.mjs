/* HARDGATE — conviction-lock.js unit tests (offline, Node 18+).
   Focus: lifecycle APIs used by gold tabs + daemon (evaluateInvalidations,
   applyHardgateConvictionLock, TIME_STOP, venue-scoped keys).
   Run: node tests/test-conviction-lock.mjs */

import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConvictionLockManager } from '../lib/daemon-conviction.mjs';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);

function loadApply(){
  const ctx = vm.createContext({ console });
  ctx.globalThis = ctx;
  ctx.window = ctx;
  ctx.evaluateTimeDecay = function(setup, candle, barIndex, maxBars){
    maxBars = maxBars || 8;
    if (!setup || !isFinite(barIndex) || !isFinite(setup.executionBarIndex)) return { action: 'HOLD' };
    if ((barIndex - setup.executionBarIndex) < maxBars) return { action: 'HOLD' };
    const close = candle.c ?? candle.close;
    const entry = setup.levels?.entry ?? setup.entry;
    const dir = setup.direction || setup.dir;
    const pnl = dir === 'long' ? close - entry : entry - close;
    if (pnl <= 0) return { action: 'MARKET_CLOSE_FULL', reason: 'MOMENTUM_DECAY' };
    return { action: 'TRAIL_SL_TIGHT', reason: 'MOMENTUM_WARNING' };
  };
  vm.runInContext(fs.readFileSync(root + 'conviction-lock.js', 'utf8'), ctx, { filename: 'conviction-lock.js' });
  return ctx;
}

const Mgr = loadConvictionLockManager();
const W = loadApply();
const apply = W.applyHardgateConvictionLock;

let pass = 0, fail = 0;
function ok(cond, msg){
  if (cond){ pass++; console.log('ok    -', msg); }
  else { fail++; console.error('FAIL  -', msg); }
}

const NOW = Date.UTC(2024, 5, 15, 12, 0, 0);
const bar = (t, o, h, l, c) => ({ t, o, h, l, c, v: 1000 });

console.log('== exports ==');
{
  ok(typeof Mgr === 'function', 'ConvictionLockManager via daemon loader');
  ok(typeof apply === 'function', 'applyHardgateConvictionLock exported');
  ok(W.SCALP_CONVICTION_EXPIRY_MS === 6 * 3600 * 1000, 'scalp expiry constant');
  ok(W.SWING_CONVICTION_EXPIRY_MS === 5 * 24 * 3600 * 1000, 'swing expiry constant');
}

console.log('== lockConviction / records ==');
{
  const mgr = new Mgr({ type: 'scalp' });
  ok(mgr.generateID('ob', 'long', 2300.4) === 'ob|long|2300', 'generateID rounds anchor');

  const base = {
    id: 'ob|long|100', type: 'scalp', direction: 'long', sym: 'XAUUSDT',
    levels: { entry: 100, stopLoss: 99, tp1: 102, tp2: 104, anchor: 100 }, tally: 3,
  };
  ok(mgr.lockConviction(Object.assign({}, base), NOW, 2).action === 'NEW_LOCK', 'first lock NEW_LOCK');
  const merged = mgr.lockConviction(Object.assign({}, base, { tally: 8 }), NOW + 1000, 2);
  ok(merged.action === 'MERGED' && merged.setup.tally === 8, 'merge within 0.5×ATR');

  const eth = Object.assign({}, base, { id: 'ob|long|101', sym: 'ETHUSDT', levels: Object.assign({}, base.levels, { anchor: 100.2 }) });
  ok(mgr.lockConviction(eth, NOW + 2000, 2).action === 'NEW_LOCK', 'different sym does not merge');

  const cand = mgr.fromCandidate({ dir: 'short', stratKey: 'sweep', entry: 50, stop: 52, t1: 48, macroHint: 'HEADWIND' }, 'scalp');
  ok(cand.macroHint === 'HEADWIND', 'fromCandidate preserves macroHint');
  const rec = mgr.toRecord(cand);
  mgr.hydrateFromRecord(rec, rec.id);
  ok(mgr.activeConvictions.get(rec.id)?.macroHint === 'HEADWIND', 'hydrate roundtrip macroHint');
}

console.log('== evaluateSetup lifecycle ==');
{
  const mgr = new Mgr({ type: 'scalp' });
  const scalpLong = {
    type: 'scalp', direction: 'long', id: 'x|long|1', timestamp: NOW,
    levels: { stopLoss: 99, tp1: 102 },
  };
  ok(mgr.evaluateSetup(scalpLong, bar(NOW, 100, 101, 98, 98.5), true, false, NOW) === 'STOPPED',
    'scalp long STOPPED on 15m close below stop');

  const scalpShort = {
    type: 'scalp', direction: 'short', id: 'x|short|1', timestamp: NOW,
    levels: { stopLoss: 101, tp1: 98 },
  };
  ok(mgr.evaluateSetup(scalpShort, bar(NOW, 100, 102, 99, 101.5), true, false, NOW) === 'STOPPED',
    'scalp short STOPPED on 15m close above stop');

  const swingLong = {
    type: 'swing', direction: 'long', id: 'y|long|1', timestamp: NOW,
    levels: { stopLoss: 99, tp1: 110 },
  };
  const h4Close = Date.UTC(2024, 5, 15, 12, 0, 0);
  ok(mgr.evaluateSetup(swingLong, bar(h4Close / 1000, 100, 101, 98, 98.2), false, true, NOW) === 'STOPPED',
    'swing long STOPPED on 4h close below stop');

  ok(mgr.evaluateSetup(
    { type: 'scalp', direction: 'long', id: 'tp', timestamp: NOW, levels: { stopLoss: 99, tp1: 101 } },
    bar(NOW, 100, 101.2, 99.5, 100.1), true, false, NOW) === 'TARGET HIT',
    'TARGET HIT on TP1 wick');

  ok(mgr.evaluateSetup(
    { type: 'scalp', direction: 'long', id: 'exp', timestamp: NOW - 7 * 3600 * 1000, levels: { stopLoss: 90, tp1: 200 } },
    bar(NOW, 100, 101, 99, 100), true, false, NOW) === 'EXPIRED',
    'EXPIRED past scalp TTL');
}

console.log('== momentum decay + TIME_STOP ==');
{
  const mgr = new Mgr({ type: 'scalp' });
  W.evaluateTimeDecay = function(setup, candle, barIndex){
    if (barIndex >= 9) return { action: 'MARKET_CLOSE_FULL', reason: 'MOMENTUM_DECAY' };
    return { action: 'HOLD' };
  };
  const decay = {
    type: 'scalp', direction: 'long', id: 'd|long|1', timestamp: NOW,
    executionState: 'FULL_RISK_ON', executionBarIndex: 0,
    levels: { stopLoss: 99, tp1: 105, entry: 100 },
  };
  ok(mgr.evaluateSetup(decay, bar(NOW, 100, 100.2, 99.8, 99.9), true, false, NOW, 9) === 'MOMENTUM DECAY',
    'MOMENTUM DECAY via evaluateTimeDecay');

  W.evaluateTimeDecay = function(setup, candle, barIndex){
    if (barIndex >= 9) return { action: 'TRAIL_SL_TIGHT', reason: 'MOMENTUM_WARNING' };
    return { action: 'HOLD' };
  };
  const trail = Object.assign({}, decay, { id: 't|long|1' });
  ok(mgr.evaluateSetup(trail, bar(NOW, 100, 101, 99.5, 100.5), true, false, NOW, 9) === null,
    'TRAIL_SL_TIGHT does not close — returns null');
  ok(trail.trailSlTight === true && trail.momentumWarning === 'MOMENTUM_WARNING',
    'TRAIL_SL_TIGHT sets trailSlTight + momentumWarning');

  W.BRAIN_TP1_BARS_SCALP = 6;
  const brainMgr = new W.ConvictionLockManager({ type: 'scalp' });
  const brain = {
    type: 'scalp', direction: 'long', stratKey: 'brain', timestamp: NOW,
    executionBarIndex: 0, levels: { stopLoss: 99, tp1: 105, entry: 100 },
  };
  ok(brainMgr.evaluateSetup(brain, bar(NOW, 100, 100.5, 99.5, 100.1), false, false, NOW, 6) === 'TIME_STOP',
    'brain TIME_STOP when TP1 not hit within maxBars');
}

console.log('== evaluateInvalidations batch ==');
{
  const mgr = new Mgr({ type: 'scalp' });
  mgr.activeConvictions.set('a', {
    type: 'scalp', direction: 'long', id: 'a', timestamp: NOW - 8 * 3600 * 1000,
    levels: { stopLoss: 99, tp1: 110 },
  });
  mgr.activeConvictions.set('b', {
    type: 'scalp', direction: 'long', id: 'b', timestamp: NOW,
    levels: { stopLoss: 99, tp1: 101 },
  });
  const closed = mgr.evaluateInvalidations(bar(NOW, 100, 101.5, 99.5, 100.2), true, false, NOW);
  ok(closed.length === 2, 'evaluateInvalidations closes multiple setups');
  ok(closed.some(x => x.status === 'EXPIRED') && closed.some(x => x.status === 'TARGET HIT'),
    'batch includes EXPIRED + TARGET HIT');
  ok(mgr.activeConvictions.size === 0, 'active map cleared after batch');
}

console.log('== applyHardgateConvictionLock ==');
{
  const liveId = 'ob|long|100';
  const store = {
    v: 1,
    live: {
      [liveId]: {
        id: liveId, dir: 'long', entry: 100, stop: 99, t1: 102, t2: 104,
        venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT', issuedAt: NOW, tally: 5,
      },
    },
    history: [],
  };
  const rows15m = [bar(NOW - 900, 100, 101, 99.5, 100), bar(NOW, 100, 100.5, 97, 98)];
  const venueRows = { 'BINANCE XAUUSDT': { rows15m } };
  const out = apply(store, [], venueRows, NOW, { type: 'scalp', rowKey: 'rows15m' });
  ok(out.transitions.length === 1 && out.transitions[0].status === 'STOPPED',
    'applyHardgate: live conviction STOPPED -> transition');
  ok(!out.store.live[liveId] && out.store.history[0].status === 'STOPPED',
    'applyHardgate: moved from live to history');

  const store2 = { v: 1, live: {}, history: [] };
  const ranked = [{
    id: 'new|long|200', dir: 'long', stratKey: 'ob', entry: 200, stop: 198, t1: 204,
    anchor: 200, atr: 2, venue: 'BINANCE XAUUSDT', sym: 'XAUUSDT', tally: 4,
  }];
  apply(store2, ranked, {}, NOW, { type: 'scalp', noMint: true });
  ok(ranked[0].vetoed === true && Object.keys(store2.live).length === 0,
    'noMint vetoes new candidate without minting');

  const store3 = { v: 1, live: {}, history: [] };
  const swingCand = [{
    id: 'sw|long|300', dir: 'long', stratKey: 'swing', entry: 300, stop: 295, t1: 310,
    anchor: 300, atr: 4, venue: 'DELTA XAUUSD', sym: 'XAUUSD', tally: 6,
  }];
  apply(store3, swingCand, {}, NOW, { type: 'swing', venueScopedKeys: true });
  ok(store3.live['DELTA XAUUSD|sw|long|300'], 'venue-scoped swing key minted');

  const store4 = {
    v: 1,
    live: { 'sw|long|300': swingCand[0] },
    history: [],
  };
  apply(store4, swingCand, {}, NOW, { type: 'swing', venueScopedKeys: true });
  ok(swingCand[0].locked === true, 'venue-scoped restore marks candidate locked');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
