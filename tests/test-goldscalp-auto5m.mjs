/* HARDGATE — hg-v1031: the GOLD SCALP 5-minute auto-refresh button.

   A visible ON/OFF button in the GOLD SCALP tab's control row that turns a
   five-minute re-scan of that desk on or off. One click, in the tab, at the
   cadence the trader asked for.

   The two rules this test exists to pin, in the spirit of hg-v958's "one page,
   one clock" and the load-time-interval lesson:

     1) LOADING goldscalp.js installs NO timer — the 5m interval is a network
        scan, so it arms only from a button click, never at module load (a real
        setInterval in Node never exits).
     2) the toggle lives on the HG_tabs registration (not a module-scope
        export), arm/disarm is idempotent (one page, one 5m clock), and the
        paint reflects ON/OFF honestly.

   Run: node tests/test-goldscalp-auto5m.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

const GI = ['indicators.js', 'indicators2.js', 'goldind.js'];
const BASE = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
  Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
  Map, Set, Symbol, Intl, isFinite, isNaN, parseFloat, parseInt,
  setTimeout, clearTimeout, encodeURIComponent, decodeURIComponent };
function boot(goldscalp){
  const timers = [];
  const callbacks = [];
  const ctx = Object.assign({}, BASE);
  ctx.clearInterval = () => {};
  ctx.setInterval = (fn, ms) => { callbacks.push(fn); timers.push(ms); return timers.length; };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  ctx.document = { createElement: () => ({ style: {}, appendChild(){}, querySelector: () => null,
      querySelectorAll: () => [] }), getElementById: () => null, querySelector: () => null,
    querySelectorAll: () => [], head: { appendChild(){} }, body: { appendChild(){}, contains: () => false },
    addEventListener(){}, removeEventListener(){}, readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network'));
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  const files = goldscalp ? GI.concat(['goldscalp.js']) : GI;
  for (const f of files)
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); } catch(e){}
  return { ctx, timers, callbacks };
}

console.log('== 1) load installs no timer; toggle lives on the registration ==');
{
  const { ctx, timers } = boot(true);
  assert(timers.length === 0, 'LOADING goldscalp.js installs NO timer (' + timers.length + ')');

  const reg = (ctx.HG_tabs || []).find(t => t && t.id === 'goldscalp');
  assert(reg && typeof reg.auto5mToggle === 'function' && typeof reg.auto5mPaint === 'function',
    'the 5m toggle + paint travel on the HG_tabs registration');
  assert(typeof ctx.gsAuto5mToggle !== 'function' && typeof ctx.gsAuto5mPaint !== 'function',
    'and are deliberately NOT module-scope exports (render-integrity guard)');

  const ui = { auto5m: { textContent: '', style: {} } };
  assert(reg.auto5mToggle(ui, { busy: false }) === 'on', 'first click arms the 5m clock (on)');
  assert(timers.length === 1 && timers[0] === 300000,
    'installs exactly one five-minute timer (' + timers.join(',') + ')');
  assert(ui.auto5m.textContent === 'AUTO-REFRESH 5m: ON', 'button paints ON (got "' + ui.auto5m.textContent + '")');

  assert(reg.auto5mToggle(ui, { busy: false }) === 'off', 'second click disarms (off)');
  assert(timers.length === 1, 'disarming installs no second timer');
  assert(ui.auto5m.textContent === 'AUTO-REFRESH 5m: OFF', 'button paints OFF again');
}

console.log('== 2) the mount renders the button and wires it ==');
{
  const stubs = {};
  function stEl(){
    return { innerHTML: '', textContent: '', className: '', disabled: false, value: '',
             style: {}, _handlers: {}, addEventListener(ev, fn){ this._handler = fn; this._handlers[ev] = fn; } };
  }
  const pane = {
    _html: '',
    set innerHTML(v){ this._html = v; },
    get innerHTML(){ return this._html; },
    querySelector(sel){ if (!stubs[sel]) stubs[sel] = stEl(); return stubs[sel]; }
  };
  const { ctx } = boot(true);
  const tab = (ctx.HG_tabs || []).find(t => t && t.id === 'goldscalp');
  tab.mount(pane);
  assert(pane._html.indexOf('id="gsAuto5m"') >= 0, 'mount renders the AUTO-REFRESH 5m button');
  assert(pane._html.indexOf('AUTO-REFRESH 5m: OFF') >= 0, 'the button starts OFF (opt-in, never surprise-scans)');
  assert(typeof stubs['#gsAuto5m']._handler === 'function', 'the 5m button is wired to a click handler');
  assert(stubs['#gsAuto5m'].textContent.indexOf('AUTO-REFRESH 5m') >= 0, 'the mounted button paint reflects the shared clock');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
