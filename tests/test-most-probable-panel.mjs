/* HARDGATE — SWING / SCALP / EDGE / BEST pin one MOST PROBABLE plan.

   After v439 the four desks scan themselves, but the leader is easy to miss:
   dual-venue merge never re-ranks the cards, and a 0 CLEAN tape hides the
   6/7 NEAR row that already has ENTRY / STOP / T1 / T2.

   Contract: each desk pins one MOST PROBABLE panel with those four levels.
   CLEAN wins when it exists. Else the best 6/7 NEAR, labelled watch-only.
   G1–G7 and crypto execute stay untouched.

   Run: node tests/test-most-probable-panel.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function boot(){
  const ctx = {
    console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp,
    document: {
      getElementById(){ return null; },
      head: { appendChild(){} },
      createElement(){ return { id: '', textContent: '' }; }
    }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['indicators.js', 'indicators2.js', 'plans.js', 'setup-ui.js']){
    vm.runInContext(read(f), ctx, { filename: f });
  }
  return ctx;
}

const HTML = read('index.html');
const EDGE = read('edge.js');
const GATES = read('cryptogates.js');
const EXEC = read('execute.js');
const APP = read('app.js');

console.log('== pick: CLEAN with levels beats hotter NEAR ==');
{
  const W = boot();
  ok(typeof W.hgSetupHasLevels === 'function', 'hgSetupHasLevels exported');
  ok(typeof W.hgPickMostProbable === 'function', 'hgPickMostProbable exported');
  ok(W.hgSetupHasLevels({ entry: 100, stop: 98, t1: 104 }) === true, 'finite entry/stop/t1 counts as levels');
  ok(W.hgSetupHasLevels({ entry: 100, stop: 100, t1: 104 }) === false, 'zero risk is not a plan');
  ok(W.hgSetupHasLevels({ entry: 100, stop: 98 }) === false, 'missing T1 is not a plan');

  const clean = { id: 'c', sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, t1: 104, t2: 106, rr: 2, postGateChecked: true };
  const near = { id: 'n', sym: 'ETHUSD', dir: 'long', entry: 10, stop: 9, t1: 12, t2: 13, rr: 4, nearClean: true, gatesPassed: 6 };
  const pick = W.hgPickMostProbable([clean], [near], 'long');
  ok(pick && pick.row && pick.row.id === 'c', 'CLEAN leads when it has levels');
  ok(pick.tier === 'clean', 'CLEAN pick is labelled clean');
}

console.log('== pick: NEAR is the leader when CLEAN is empty ==');
{
  const W = boot();
  const nearA = { id: 'a', sym: 'SOLUSD', dir: 'short', entry: 200, stop: 206, t1: 188, t2: 182, rr: 2, nearClean: true, gatesPassed: 6, postGateChecked: true };
  const nearB = { id: 'b', sym: 'XRPUSD', dir: 'long', entry: 2, stop: 1.9, t1: 2.3, rr: 3, nearClean: true, gatesPassed: 6, postGateChecked: true };
  const pick = W.hgPickMostProbable([], [nearA, nearB], 'short');
  ok(pick && pick.row && pick.row.id === 'a', 'tape-aligned NEAR wins MOST PROBABLE WATCH');
  ok(pick.tier === 'near', 'empty CLEAN falls back to NEAR');
  ok(W.hgPickMostProbable([], [], 'long') === null, 'no levels → no invented leader');
  const closest = { id: 'cl', sym: 'B-ETH_USDT', dir: 'long', entry: 2245, stop: 2200, t1: 2340, t2: 2380, rr: 2.1, gatesPassed: 5, forming: true };
  const draft = W.hgPickMostProbable([], [], 'long', closest);
  ok(draft && draft.tier === 'forming' && draft.row.sym === 'B-ETH_USDT', 'closest ≥5/7 is last-resort draft');
}

console.log('== panel: ENTRY / STOP / T1 / T2 on the banner ==');
{
  const W = boot();
  ok(typeof W.hgMostProbablePanelHTML === 'function', 'hgMostProbablePanelHTML exported');
  const html = W.hgMostProbablePanelHTML('swing', {
    tier: 'clean',
    row: { sym: 'BTCUSD', dir: 'long', entry: 111111, stop: 110000, t1: 113500, t2: 115000, rr: 2.2, venue: 'Delta India' }
  });
  ok(/MOST PROBABLE/.test(html), 'banner says MOST PROBABLE');
  ok(/data-hg-mp/.test(html), 'banner is addressable for pin/replace');
  ok(/ENTRY/.test(html) && /111111/.test(html), 'ENTRY prints the number');
  ok(/STOP/.test(html) && /110000/.test(html), 'STOP prints the number');
  ok(/T1/.test(html) && /113500/.test(html), 'T1 prints the number');
  ok(/T2/.test(html) && /115000/.test(html), 'T2 prints the number');
  ok(/BTCUSD/.test(html) && /LONG/.test(html), 'symbol and side are on the banner');
  ok(/7\/7 CLEAN/.test(html), 'CLEAN banner names 7/7');
  ok(!/watch only/i.test(html), 'CLEAN banner is not watch-only');

  const nearHtml = W.hgMostProbablePanelHTML('scalp', {
    tier: 'near',
    row: { sym: 'ETHUSD', dir: 'short', entry: 4000, stop: 4080, t1: 3840, t2: 3760, rr: 2, gatesPassed: 6, missing: ['G5 vol+wick'] }
  });
  ok(/MOST PROBABLE/.test(nearHtml) && /NEAR/.test(nearHtml), 'NEAR banner still leads the desk');
  ok(/watch only/i.test(nearHtml) && /not a ticket/i.test(nearHtml), 'NEAR banner is honest');
  ok(/4000/.test(nearHtml) && /4080/.test(nearHtml) && /3840/.test(nearHtml), 'NEAR still prints ENTRY / STOP / T1');
  ok(W.hgMostProbablePanelHTML('best', null) === '', 'no pick → empty string, not a fake card');
  const draftHtml = W.hgMostProbablePanelHTML('swing', {
    tier: 'forming',
    row: { sym: 'B-ETH_USDT', dir: 'long', entry: 2245.59, stop: 2200, t1: 2340, t2: 2380, rr: 2, gatesPassed: 5, missing: ['G3 RSI', 'G6 R:R'] }
  });
  ok(/CLOSEST/.test(draftHtml) && /not a ticket/.test(draftHtml) && /2245/.test(draftHtml),
     'closest banner prints draft levels and refuses the ticket label');

  const chipHtml = W.hgMostProbablePanelHTML('omnibtc', {
    tier: 'near',
    row: {
      sym: 'B-BTC_USDT', dir: 'long', entry: 77728.40, stop: 76857.10, t1: 79471,
      gatesPassed: 6, evidenceChips: ['OPTION FLOW neutral']
    }
  });
  ok(/OPTION FLOW neutral/.test(chipHtml) && /hg-mp-chips/.test(chipHtml),
     'MOST PROBABLE banner prints OPTION FLOW / ORDER FLOW chips on the setup');
}

console.log('== SWING / SCALP / EDGE / BEST pin the banner ==');
{
  ok(/hgPickMostProbable\(/.test(HTML), 'SWING/SCALP paint uses hgPickMostProbable');
  ok(/hgMostProbablePanelHTML\(/.test(HTML) || /hgPinMostProbablePanel\(/.test(HTML),
     'SWING/SCALP insert the MOST PROBABLE panel');
  ok(/hgPaintCryptoDeskFromSnap/.test(HTML) && /hgMostProbablePanelHTML|hgPinMostProbablePanel/.test(HTML),
     'snap paint (quiet warm + tab sync) includes the panel');
  ok(/hgPublishCryptoScanSnap[\s\S]{0,400}hgPaintCryptoDeskFromSnap|hgPinMostProbablePanel/.test(HTML)
     || /mergedCands[\s\S]{0,500}hgPaintCryptoDeskFromSnap|hgPinMostProbablePanel/.test(HTML),
     'dual-venue merge pins the ranked leader (does not leave unranked incremental cards)');
  ok(/hgMostProbablePanelHTML|hgPinMostProbablePanel/.test(EDGE),
     'EDGE pins MOST PROBABLE from the ranked found[0] plan');
  ok(/MOST PROBABLE SETUP/.test(HTML) && /function runBest/.test(HTML),
     'BEST names the #1 CLEAN as MOST PROBABLE SETUP');
  ok(/function runCascadeCore[\s\S]*swingTryNear/.test(HTML),
     'BEST cascade collects NEAR levels');
  ok(/!clean\.length[\s\S]{0,900}hgMostProbablePanelHTML/.test(HTML),
     'BEST empty path pins a NEAR/closest plan with levels');
}

console.log('== G1–G7 and crypto execute unchanged ==');
{
  ok(/var CG_G1_SPREAD_ATR = 0\.25;/.test(GATES), 'G1 spread still 0.25×ATR');
  ok(/var CG_G5_VZ_MIN = 0\.5;/.test(GATES), 'G5 volZ still 0.5');
  ok(/var CG_SWING_ANCHOR_ATR = 1\.5;/.test(GATES), 'ANCHOR still 1.5×ATR');
  ok(/var CG_SWING_RR_MIN = 2\.0;/.test(GATES), 'G6 R:R still 2.0');
  ok(/var HG_LIVE_TRADING_ENABLED = false;/.test(EXEC), 'browser live trading stays disabled');
  ok(/const HG_DAEMON_EXECUTION_ENABLED = false;/.test(APP), 'daemon execute stays disabled');
}

console.log('\nALL MOST-PROBABLE PANEL TESTS PASSED (' + passed + ')');
