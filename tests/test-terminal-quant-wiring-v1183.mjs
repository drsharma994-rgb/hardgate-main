/* HARDGATE — hg-v1183: terminal-quant wiring integrity.

   The terminal-quant modules (ws-multiplex, alert-dispatcher, audio-
   annunciator, liq-clusters, risk-allocator, journal-db, macro-calendar,
   execute-order) are loaded and consumed by quant-desk.js, and the gold
   desks emit ARMED setups into HG_quantEmit -> dispatcher/audio/journal.
   The order router is a DELIBERATE security stub (browser-held secrets are
   stealable and Binance rejects the cross-origin POST; orders route
   server-side). This guard pins all of it so none can silently regress.

   Run: node tests/test-terminal-quant-wiring-v1183.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const MODS = ['ws-multiplex.js','alert-dispatcher.js','audio-annunciator.js','liq-clusters.js','risk-allocator.js','journal-db.js','macro-calendar.js','execute-order.js'];

console.log('== every terminal-quant module is loaded and in the shell ==');
{
  const html = read('index.html');
  const sw = read('sw.js');
  for (const m of MODS){
    ok(html.indexOf('<script src="' + m + '?v=') >= 0, m + ' is loaded in index.html');
    ok(sw.indexOf("./" + m) >= 0, m + ' is in the HG_SHELL precache');
  }
}

console.log('== quant-desk exposes the seams and the gold desks emit into them ==');
{
  const qd = read('quant-desk.js');
  ok(qd.indexOf('root.hgMacroEventLock') >= 0, 'the macro blackout seam is defined');
  ok(qd.indexOf('root.HG_riskLine') >= 0, 'the risk/size line seam is defined');
  ok(qd.indexOf('root.HG_quantEmit') >= 0, 'the ARMED emit seam is defined');
  const gce = read('gold-core-engine.js');
  const gg = read('ganeshgold.js');
  ok(gce.indexOf('HG_quantEmit') >= 0, 'the gold Judas scalp emits ARMED into the dispatcher');
  ok(gg.indexOf('HG_quantEmit') >= 0, 'the ganesh gold desk emits ARMED into the dispatcher');
}

console.log('== the order router is a deliberate security stub ==');
{
  const eo = read('execute-order.js');
  ok(eo.indexOf('stealable') >= 0 && eo.indexOf('rejects the cross-origin POST') >= 0, 'the header names why browser-direct routing is disabled');
  ok(eo.indexOf('Browser order routing is disabled') >= 0, 'the execute method rejects, it does not route');
}

console.log('== no exchange secret is ever written to the browser ==');
{
  let found = [];
  for (const f of fs.readdirSync(ROOT).filter(x => x.endsWith('.js'))) found.push(read(f));
  found.push(read('index.html'));
  const leaked = found.some(s => s.indexOf('HG_BINANCE_API_SECRET') >= 0);
  ok(leaked === false, 'no source reads or writes an exchange secret into localStorage');
}

console.log('== driven through quant-desk.js: the emit path works ==');
{
  const calls = {};
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, Date, Number, String, Object, Array, JSON, Error, Promise, RegExp, isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { getItem: (k) => (k === 'HG_EQUITY' ? '10000' : (k === 'HG_RISK_PCT' ? '1' : '')), setItem(){}, removeItem(){} };
  ctx.WebSocket = undefined;   /* no socket in the harness - bootSocket must skip cleanly */
  ctx.setInterval = () => 0; ctx.clearInterval = () => {}; ctx.setTimeout = () => 0; ctx.clearTimeout = () => {};  /* no lingering timers */
  const el = () => ({ style:{}, innerHTML:'', textContent:'', value:'', checked:false, appendChild(){}, setAttribute(){}, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[], click(){} });
  ctx.document = { readyState: 'complete', body: el(), createElement: () => el(),
                   getElementById: () => el(), querySelector: () => null, querySelectorAll: () => [], addEventListener(){} };
  ctx.HG_AlertDispatcher = function(){ this.dispatchArmedSetup = s => { calls.dispatched = s; }; };
  ctx.HG_AudioAnnunciator = function(){ this.voiceEnabled = true; this.playArmedChime = () => { calls.chime = true; }; this.speak = t => { calls.spoken = t; }; };
  ctx.HG_MacroCalendar = function(){ this.checkBlackout = () => ({ veto: false, evidence: 'clean' }); this.refreshEvents = () => {}; };
  ctx.HG_JournalDB = function(){ this.recordSetup = s => { calls.recorded = s; }; };
  ctx.HG_LiqClusterEstimator = function(){};
  ctx.HG_RiskAllocator = function(eq, pct){ this.calculateSize = (e,s,t) => ({ positionQty: 2, riskCapital: 100, notionalUsd: 5300, netRR: 2.4 }); };
  vm.createContext(ctx);
  vm.runInContext(read('quant-desk.js'), ctx, { filename: 'quant-desk.js' });
  ok(typeof ctx.hgMacroEventLock === 'function', 'the macro lock seam exists after boot');
  ok(typeof ctx.HG_quantEmit === 'function' && typeof ctx.HG_riskLine === 'function', 'the emit and risk seams exist');
  const setup = { status: 'ARMED', symbol: 'XAUUSD', direction: 'BULL', entryPrice: 2600, stopLoss: 2595, targetPrice: 2612 };
  ctx.HG_quantEmit(setup);
  ok(ctx.__hgLastArmed === setup, 'an ARMED setup is recorded');
  ok(calls.dispatched === setup && calls.chime === true && calls.recorded === setup, 'the dispatcher, chime and journal all fired');
  const line = ctx.HG_riskLine(setup);
  ok(typeof line === 'string' && line.indexOf('Size 2') >= 0, 'the risk line sizes the position');
  const idle = { status: 'STALKING', symbol: 'XAUUSD' };
  ctx.HG_quantEmit(idle);
  ok(ctx.__hgLastArmed === setup, 'a non-ARMED setup does not overwrite the last ARMED');
}

console.log('\ntest-terminal-quant-wiring-v1183: ' + passed + ' passed, 0 failed');
