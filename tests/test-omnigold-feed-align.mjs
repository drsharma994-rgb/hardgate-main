/* HARDGATE — OMNIGOLD must use getXAUCandles and scale proxy plans to live spot.

   Defect: OMNIGOLD ran its own fetch chain (XM → getGoldCandles → PAXG only)
   and printed feed-native ENTRY/STOP/T1 without the spot alignment GOLD SCALP
   and GOLD SWING apply. On twelvedata/perp proxies the levels sat off live
   spot while the tab still labelled them XAUUSD.

   Contract:
     1. hgOgFetchRows prefers getXAUCandles when exported
     2. hgOgAlignPlansToSpot scales plan + level, preserves R:R
     3. venue-native feeds (xm-xauusd, delta-xaut) skip scaling

   Run: node tests/test-omnigold-feed-align.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

function boot(extra){
  const ctx = { console, Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
                Number, String, Promise, RegExp, setTimeout, clearTimeout, Float64Array, Infinity, NaN };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = [];
  ctx.S = { goldSrcByTf: {}, goldDataSource: null };
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, innerHTML: '', appendChild(){}, setAttribute(){},
                    querySelector: () => null, querySelectorAll: () => [] }),
                   getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
                   head: { appendChild(){} }, documentElement: { appendChild(){} }, addEventListener(){} };
  if (extra) Object.assign(ctx, extra);
  vm.createContext(ctx);
  for (const f of ['indicators.js','indicators2.js','fixpack14-core.js','hg-mechanics.js','hg-forward.js',
                   'plans.js','hg-gates.js','hg-plan.js','structure-levels.js','best-levels.js',
                   'gold-best-levels.js','regime.js','goldind.js','pinegoldmath.js','omniroute.js','omnigold.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

console.log('== fetch prefers getXAUCandles ==');
{
  const rows = [{ t: 1, o: 100, h: 101, l: 99, c: 100, v: 1 }];
  const ctx = boot({
    getXAUCandles: async (tf, n) => {
      ctx.__xauCalled = { tf, n };
      return rows;
    },
    getXmGoldCandles: async () => ({ rows: [{ t: 2, o: 50, h: 51, l: 49, c: 50, v: 1 }], source: 'xm-xauusd' }),
    S: { goldSrcByTf: { '1h': 'binance-xau' }, goldDataSource: 'binance-xau' }
  });
  ok(typeof ctx.hgOgFetchRows === 'function', 'hgOgFetchRows exported');
  const got = await ctx.hgOgFetchRows('1h', 100);
  ok(ctx.__xauCalled && ctx.__xauCalled.tf === '1h', 'getXAUCandles invoked');
  ok(got.source === 'binance-xau', 'source read from S.goldSrcByTf');
  ok(got.rows[0].c === 100, 'rows from getXAUCandles, not XM fallback');
}

console.log('\n== spot align scales plans, preserves R:R ==');
{
  const W = boot();
  const card = {
    dir: 'short', level: 4600,
    plan: { entry: 4600, stop: 4663.8, t1: 4472.4, t2: 4377, risk: 63.8, rr1: 2 }
  };
  W.hgOgAlignPlansToSpot([card], 4600, 4700);
  ok(card.spotAligned === true, 'spotAligned stamped');
  ok(Math.abs(card.plan.entry - 4700) < 0.01, 'entry scaled to spot (' + card.plan.entry + ')');
  ok(Math.abs(card.plan.stop - (4663.8 * 4700 / 4600)) < 0.1, 'stop scaled (' + card.plan.stop + ')');
  var risk = card.plan.stop - card.plan.entry;
  var rew = card.plan.entry - card.plan.t1;
  ok(Math.abs(rew / risk - 2) < 0.02, 'R:R preserved after scale (got ' + (rew / risk).toFixed(3) + 'R)');
}

console.log('\n== tiny drift is a no-op ==');
{
  const W = boot();
  const card = { plan: { entry: 4600, stop: 4660, t1: 4480 } };
  W.hgOgAlignPlansToSpot([card], 4600, 4605);
  ok(!card.spotAligned, 'sub-0.35% drift does not scale');
  ok(card.plan.entry === 4600, 'entry unchanged');
}

console.log('\n== far VETO watch is not MOST PROBABLE ==');
{
  const W = boot();
  const far = { horizon: 'SCALP', kind: 'ORB', dir: 'short',
    grade: { ticket: false, vetoes: ['x'] },
    plan: { entry: 4633.59, stop: 4699.3, t1: 4502.17 }, distAtr: 2.4 };
  const near = { horizon: 'SCALP', kind: 'MMOVE', dir: 'short',
    grade: { ticket: false, vetoes: ['y'] },
    plan: { entry: 4598, stop: 4660, t1: 4470 }, distAtr: 0.5 };
  ok(W.hgOgPickWatchFor([far], 'SCALP', 'short') === null, 'ORB 2.4×ATR off market stays out of MP');
  const p = W.hgOgPickWatchFor([near, far], 'SCALP', 'short');
  ok(p && p.plan.entry === 4598, 'near watch still shown (' + (p && p.plan.entry) + ')');
}

console.log('\n== sub-0.15% drift still skips align ==');
{
  const W = boot();
  const card = { plan: { entry: 4600, stop: 4660, t1: 4480 } };
  W.hgOgAlignPlansToSpot([card], 4600, 4604, 0.15);
  ok(!card.spotAligned, '0.09% drift does not scale at 0.15% floor');
  ok(card.plan.entry === 4600, 'entry unchanged');
}

console.log('\n== 11pt live gap scales (4600 feed vs 4589 spot) ==');
{
  const W = boot();
  const card = {
    dir: 'short', level: 4600,
    plan: { entry: 4600.02, stop: 4708.83, t1: 4382.39, t2: 4219.17, rr1: 2 }
  };
  W.hgOgAlignPlansToSpot([card], 4600.02, 4589, 0.15);
  ok(card.spotAligned === true, '0.24% / 11pt drift scales');
  ok(Math.abs(card.plan.entry - 4589) < 1.5, 'entry lands on live spot (~' + card.plan.entry + ')');
  var risk = card.plan.stop - card.plan.entry;
  var rew = card.plan.entry - card.plan.t1;
  ok(Math.abs(rew / risk - 2) < 0.03, 'R:R preserved (' + (rew / risk).toFixed(3) + 'R)');
}

console.log('\n== entry note names market vs limit retest ==');
{
  const W = boot();
  const note = W.hgOgEntryMarketNote({ dir: 'short', livePx: 4597 }, { entry: 4633.59 });
  ok(/4597/.test(note), 'names market (' + note + ')');
  ok(/limit retest/.test(note), 'calls out limit retest');
  ok(/37/.test(note), 'names point gap');
}

console.log('\nomnigold feed align: ' + passed + ' checks passed');
