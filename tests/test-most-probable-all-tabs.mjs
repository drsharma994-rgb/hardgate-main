/* HARDGATE — every market-scan tab pins one MOST PROBABLE plan.

   v440 covered SWING / SCALP / EDGE / BEST. Owner policy: every tab that
   scans the market shows the same ENTRY / STOP / T1 / T2 banner. CLEAN /
   confirmed / ticket rows win. Else NEAR. Else one closest draft. No
   levels → no banner. G1–G7 and crypto execute stay untouched.

   Run: node tests/test-most-probable-all-tabs.mjs */
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
    Number, String, Promise, RegExp, setTimeout, clearTimeout,
    document: {
      getElementById(){ return null; },
      querySelector(){ return null; },
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

function fakeHost(){
  return {
    innerHTML: '',
    querySelector(){ return null; },
    insertAdjacentHTML(pos, html){
      if (pos === 'afterbegin') this.innerHTML = html + this.innerHTML;
      else this.innerHTML += html;
    }
  };
}

const HTML = read('index.html');
const PLANS = read('plans.js');
const SETUP = read('setup-ui.js');
const GATES = read('cryptogates.js');
const EXEC = read('execute.js');
const APP = read('app.js');

const MARKET_SCAN_TABS = [
  'brain', 'trendmx', 'startrader',
  'omnibtc', 'omnipresent', 'omniroute', 'best', 'swing', 'scalp', 'edge', 'smart',
  'squeeze', 'reversalsniper', 'smc', 'ob', 'trap', 'div', 'coil', 'apex',
  'oiflow', 'liqs', 'chartvision', 'carry', 'venueprem', 'termbasis',
  'super-gold', 'omnigold', 'goldswing', 'goldscalp', 'gold', 'goldpro',
  'goldpine',
  'super-setup', 'super-best', 'super-sniper',
  'pine', 'pine-msb', 'pine-sqz', 'pine-smf', 'pine-ht', 'pine-smc',
  'pine-cipher', 'pine-rf', 'pine-nw', 'pine-avwap',
  'meanrev', 'basis', 'search', 'finder', 'aiagent', 'execute'
];

const MODULE_FILE = {
  brain: 'brain.js',
  trendmx: 'trendtable.js',
  startrader: 'startradertab.js',
  omnibtc: 'omnibtc.js',
  omnipresent: 'omnipresent.js',
  omniroute: 'omniroute.js',
  edge: 'edge.js',
  squeeze: 'squeeze.js',
  reversalsniper: 'reversalsniper.js',
  oiflow: 'oiflow.js',
  liqs: 'liqs.js',
  chartvision: 'chartvision-tab.js',
  carry: 'carry.js',
  venueprem: 'venuepremium.js',
  termbasis: 'termbasis.js',
  'super-gold': 'super-gold.js',
  omnigold: 'omnigold.js',
  goldswing: 'goldswing.js',
  goldscalp: 'goldscalp.js',
  goldpro: 'goldpro.js',
  goldpine: 'goldpine.js',
  'super-setup': 'supersetup.js',
  'super-best': 'super-best.js',
  'super-sniper': 'super-sniper.js',
  pine: 'pine.js',
  'pine-msb': 'pinemsb.js',
  meanrev: 'meanrev.js',
  aiagent: 'ai-agent.js',
  execute: 'engine.js'
};

const CARDHTML_TABS = ['coil', 'apex', 'trap', 'smc', 'ob', 'div', 'smart', 'basis', 'search', 'finder', 'gold'];
const PINE_SUB_VIA_HARNESS = ['pine-sqz', 'pine-smf', 'pine-ht', 'pine-smc', 'pine-cipher', 'pine-rf', 'pine-nw', 'pine-avwap'];

function sourceHasPin(src){
  return /hgMpPin\(/.test(src) || /hgPinMostProbablePanel\(/.test(src)
    || /hgMostProbablePanelHTML\(/.test(src)
    || /gsx-eye/.test(src) || /gsw-eye/.test(src);
}

console.log('== normalize: common setup shapes become one row ==');
{
  const W = boot();
  ok(typeof W.hgNormalizeSetupRow === 'function', 'hgNormalizeSetupRow exported');
  ok(typeof W.hgCollectSetupRows === 'function', 'hgCollectSetupRows exported');
  ok(typeof W.hgPickMostProbableAny === 'function', 'hgPickMostProbableAny exported');
  ok(typeof W.hgMpPin === 'function', 'hgMpPin exported');
  ok(typeof W.hgMpHost === 'function', 'hgMpHost exported');

  const flat = W.hgNormalizeSetupRow({ sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, t1: 104, t2: 106 });
  ok(flat && flat.sym === 'BTCUSD' && flat.entry === 100 && flat.t1 === 104, 'flat {sym,dir,entry,stop,t1} normalizes');

  const best = W.hgNormalizeSetupRow({ t: { symbol: 'ETHUSD' }, dir: 'short', entry: 4000, stop: 4080, t1: 3840 });
  ok(best && best.sym === 'ETHUSD' && best.dir === 'short', 'BEST {t.symbol} normalizes');

  const smart = W.hgNormalizeSetupRow({
    sym: 'SOLUSDT', venueSym: 'SOLUSD', cls: { dir: 'long' },
    setup: { entry: 150, stop: 147, t1: 156, t2: 160, dir: 'long', confirmed: true }
  });
  ok(smart && smart.sym === 'SOLUSD' && smart.entry === 150 && smart.clean === true,
     'SMART {setup, venueSym, confirmed} normalizes');

  const omni = W.hgNormalizeSetupRow({
    sym: 'XAUUSD', dir: 'short', plan: { entry: 2400, stop: 2420, t1: 2360, t2: 2340 }
  });
  ok(omni && omni.entry === 2400 && omni.stop === 2420 && omni.t1 === 2360, 'nested plan.entry merges');

  const alias = W.hgNormalizeSetupRow({ symbol: 'BNBUSD', side: 'long', sl: 580, tp: 620, entry: 600 });
  ok(alias && alias.sym === 'BNBUSD' && alias.dir === 'long' && alias.stop === 580 && alias.t1 === 620,
     'sl/tp/side/symbol aliases map');

  const sniper = W.hgNormalizeSetupRow({
    sym: 'BTCUSD', setup: { dir: 'long', entry: 100, stop: 98.2, t1: 103.6, t2: 106.3, conviction: 6 }
  });
  ok(sniper && sniper.t1 === 103.6 && sniper.dir === 'long', 'reversal-sniper {setup} normalizes');

  const meanrev = W.hgNormalizeSetupRow({
    sym: 'SOLUSD', sig: { dir: 'long', entry: 150, stop: 147, target: 156 }
  });
  ok(meanrev && meanrev.dir === 'long' && meanrev.entry === 150 && meanrev.t1 === 156,
     'MEANREV {sig.entry/stop/target} normalizes');

  const squeezePlan = W.hgNormalizeSetupRow({
    sym: 'ETHUSD', dir: 'short', plan: { entry: 4000, stop: 4080, t1: 3840, t2: 3760 }
  });
  ok(squeezePlan && squeezePlan.entry === 4000 && squeezePlan.t1 === 3840,
     'SQUEEZE plan object (not the HTML string) normalizes');
  ok(W.hgNormalizeSetupRow({ sym: 'ETHUSD', dir: 'short', plan: 'ENTRY 4000' }) === null,
     'SQUEEZE HTML plan string is not treated as levels');

  ok(W.hgNormalizeSetupRow({ sym: 'X', dir: 'long', entry: 1, stop: 1, t1: 2 }) === null, 'zero-risk row is dropped');
  ok(W.hgNormalizeSetupRow(null) === null, 'null input is dropped');
}

console.log('== pick-any: CLEAN / NEAR / closest, never invents a ticket ==');
{
  const W = boot();
  const clean = { sym: 'BTCUSD', dir: 'long', entry: 100, stop: 98, t1: 104, t2: 106, clean: true };
  const near = { sym: 'ETHUSD', dir: 'long', entry: 10, stop: 9.7, t1: 10.8, nearClean: true, passed: 6 };
  const draft = { sym: 'SOLUSD', dir: 'long', entry: 150, stop: 147, t1: 156, forming: true, passed: 5 };

  const a = W.hgPickMostProbableAny([clean, near], 'long');
  ok(a && a.tier === 'clean' && a.row.sym === 'BTCUSD', 'array payload: CLEAN wins');

  const b = W.hgPickMostProbableAny({ nearCands: [near], closest: draft }, 'long');
  ok(b && b.tier === 'near' && b.row.sym === 'ETHUSD', 'object payload: NEAR when CLEAN empty');

  const c = W.hgPickMostProbableAny({ closest: draft }, 'long');
  ok(c && c.tier === 'forming' && c.row.sym === 'SOLUSD', 'closest draft is last resort');

  ok(W.hgPickMostProbableAny([], 'long') === null, 'empty payload → no invented leader');
  ok(W.hgPickMostProbableAny({ rows: [{ sym: 'X', dir: 'long' }] }, 'long') === null, 'no levels → no banner');

  const trap = W.hgPickMostProbableAny([{
    sym: 'BTCUSD', dir: 'short', entry: 100, stop: 102, t1: 96, t2: 94, tier: 'clean'
  }], 'short');
  ok(trap && trap.tier === 'clean' && trap.row.entry === 100, 'strategy CLEAN card without 7-gate tally still leads');
}

console.log('== pin: banner prints ENTRY / STOP / T1 / T2 on any host ==');
{
  const W = boot();
  const host = fakeHost();
  const pick = W.hgMpPin('trap', [{
    sym: 'BTCUSD', dir: 'short', entry: 111111, stop: 112000, t1: 109000, t2: 107500, rr: 2
  }], 'short', host);
  ok(pick && pick.row && pick.row.sym === 'BTCUSD', 'hgMpPin returns the pick');
  ok(/MOST PROBABLE/.test(host.innerHTML), 'banner says MOST PROBABLE');
  ok(/data-hg-mp="trap"/.test(host.innerHTML), 'banner is addressable');
  ok(/ENTRY/.test(host.innerHTML) && /111111/.test(host.innerHTML), 'ENTRY prints');
  ok(/STOP/.test(host.innerHTML) && /112000/.test(host.innerHTML), 'STOP prints');
  ok(/T1/.test(host.innerHTML) && /109000/.test(host.innerHTML), 'T1 prints');
  ok(/T2/.test(host.innerHTML) && /107500/.test(host.innerHTML), 'T2 prints');

  const empty = fakeHost();
  ok(W.hgMpPin('coil', [], 'long', empty) === null, 'empty scan does not invent a banner');
  ok(empty.innerHTML === '', 'empty host stays empty');

  const leader = W.hgMostProbablePanelHTML('trap', {
    tier: 'clean',
    row: { sym: 'ETHUSD', dir: 'long', entry: 2000, stop: 1980, t1: 2060 }
  });
  ok(/MOST PROBABLE SETUP/.test(leader), 'non-gate tab still says MOST PROBABLE SETUP');
  ok(/LEADER|CLEAN/.test(leader), 'strategy leader is labelled honestly (not a fake 7/7 when tally is missing)');
}

console.log('== cardHTML is the choke point for inline scanners ==');
{
  ok(/function cardHTML\(/.test(HTML) && /hgMpNoteCard\(/.test(HTML),
     'inline cardHTML notes every card with levels');
  ok(/function smartCardHTML\(/.test(HTML) && /hgMpNoteCard\(/.test(HTML),
     'SMART cards share the same note path');
  ok(/function hgMpNoteCard\(/.test(HTML) || /function hgMpNoteCard\(/.test(SETUP),
     'hgMpNoteCard exists');
  ok(/function hgMpFlush\(/.test(HTML) || /function hgMpFlush\(/.test(SETUP),
     'hgMpFlush pins after the scan paints');
  ok(/HG_MP_HOST|hgMpHost\(/.test(SETUP) || /HG_MP_HOST|hgMpHost\(/.test(PLANS),
     'host map lives on the shared helper');
}

console.log('== every market-scan tab has a pin path ==');
{
  const pineSub = read('pine-sub.js');
  ok(/hgMpPin\(/.test(pineSub), 'pine-sub harness pins for the eight script tabs');

  for (const tab of MARKET_SCAN_TABS){
    let covered = false;
    let via = '';
    if (CARDHTML_TABS.indexOf(tab) >= 0){
      covered = /hgMpNoteCard\(/.test(HTML);
      via = 'cardHTML note';
    } else if (PINE_SUB_VIA_HARNESS.indexOf(tab) >= 0){
      covered = /hgMpPin\(/.test(pineSub);
      via = 'pine-sub harness';
    } else if (tab === 'swing' || tab === 'scalp' || tab === 'best'){
      covered = /hgPickMostProbable\(/.test(HTML) && /hgMostProbablePanelHTML|hgPinMostProbablePanel|hgMpPin/.test(HTML);
      via = 'crypto desk snap';
    } else if (tab === 'goldscalp'){
      covered = /gsx-eye/.test(read('goldscalp.js')) && /MOST PROBABLE SETUP/.test(read('goldscalp.js'));
      via = 'gold scalp eye banner';
    } else if (tab === 'goldswing'){
      covered = /gsw-eye/.test(read('goldswing.js')) && /MOST PROBABLE SETUP/.test(read('goldswing.js'));
      via = 'gold swing eye banner';
    } else {
      const file = MODULE_FILE[tab];
      ok(!!file, tab + ' has a module file mapping');
      const src = read(file);
      covered = sourceHasPin(src);
      via = file;
    }
    ok(covered, tab + ' pins MOST PROBABLE via ' + via);
  }
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

console.log('\nALL MOST-PROBABLE ALL-TABS TESTS PASSED (' + passed + ')');
