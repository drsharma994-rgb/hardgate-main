/* HARDGATE — hg-v1032: per-tab 5-minute auto-refresh toggle (every tab).

   Every tab pane gets its own ON/OFF button injected into its header, turning
   a five-minute re-scan of THAT tab on or off. Independent per tab, one timer
   per tab, armed only from a click, riding the same hgScanOneTab the HARD
   REFRESH uses.

   What this pins (the hg-v958 rules, generalized):
     1) the block lives in index.html beside the scan pipeline;
     2) toggling ON installs exactly one five-minute (300000ms) timer, OFF
        clears it;
     3) the paint reflects ON/OFF honestly and the button is injected once;
     4) every tab keeps its own independent state.

   Run: node tests/test-tab-auto-refresh-5m.mjs */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
function assert(c, m){ if (c){ pass++; console.log('  ok   - ' + m); } else { fail++; console.error('  FAIL - ' + m); } }

const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const start = HTML.indexOf('const HG_TAB_AUTO_MS =');
const end = HTML.indexOf('function scheduleTabAutoScan(', start);
assert(start > 0 && end > start, 'the per-tab auto-refresh block is locatable in index.html');
const block = HTML.slice(start, end);

/* boot the block on a stub DOM with a fake interval clock */
function boot(){
  const timers = [], callbacks = [], cleared = [], els = {};
  function fakeEl(tag){
    return { tag: tag, style: {}, textContent: '', className: '', type: '', _id: '',
      _handlers: {}, firstChild: null,
      addEventListener(ev, fn){ this._handlers[ev] = fn; }, appendChild(){}, insertBefore(){},
      set id(v){ this._id = v; els[v] = this; }, get id(){ return this._id; } };
  }
  const ctx = { console: { log(){}, warn(){}, error(){} },
    Math, Date, Number, String, Object, Array, JSON, Error, TypeError, Promise, RegExp,
    isFinite, isNaN, parseFloat, parseInt, setTimeout, clearTimeout,
    setInterval: (fn, ms) => { callbacks.push(fn); timers.push(ms); return timers.length; },
    clearInterval: (id) => { cleared.push(id); },
    document: { getElementById: (id) => els[id], createElement: (tag) => fakeEl(tag),
      querySelector: () => null, querySelectorAll: () => [] } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(block, ctx, { filename: 'index.html:tab-auto-refresh' });
  return { ctx, timers, callbacks, cleared, els,
    pane(id){ els['tab_' + id] = { firstChild: { style: {} }, style: {}, appendChild(){}, insertBefore(){} }; } };
}

console.log('== the primitives travel, and the cadence is five minutes ==');
{
  const B = boot();
  const { ctx } = B;
  assert(typeof ctx.hgTabAutoToggle === 'function' && typeof ctx.hgTabAutoPaint === 'function'
    && typeof ctx.hgEnsureTabAutoBtn === 'function', 'toggle / paint / ensure are all defined');
  B.pane('goldscalp');
  const b = ctx.hgEnsureTabAutoBtn('goldscalp');
  assert(!!b && b.id === 'tabAuto_goldscalp', 'injects the tab auto button');
  assert(b.textContent === 'AUTO-REFRESH 5m OFF', 'starts OFF (opt-in, never surprise-scans)');
  assert(ctx.hgEnsureTabAutoBtn('goldscalp') === b, 'a second ensure returns the SAME button (idempotent)');
}

console.log('== each tab keeps its own button and its own state ==');
{
  const B = boot();
  const { ctx } = B;
  B.pane('goldscalp'); B.pane('goldswing');
  const b1 = ctx.hgEnsureTabAutoBtn('goldscalp');
  const b2 = ctx.hgEnsureTabAutoBtn('goldswing');
  assert(b1 && b2 && b1 !== b2 && b1.id === 'tabAuto_goldscalp' && b2.id === 'tabAuto_goldswing',
    'different tabs get different buttons');
  assert(ctx.hgEnsureTabAutoBtn('ghost') === null, 'a tab with no pane fails open (no button)');

  assert(ctx.hgTabAutoToggle('goldscalp') === 'on', 'arming goldscalp → on');
  assert(B.timers.length === 1 && B.timers[0] === 300000, 'installs exactly one five-minute timer (' + B.timers.join(',') + ')');
  assert(b1.textContent === 'AUTO-REFRESH 5m ON' && b1.style.background === '#16A34A', 'goldscalp paints ON + highlight');

  assert(ctx.hgTabAutoToggle('goldswing') === 'on', 'arming goldswing → on (independent)');
  assert(B.timers.length === 2, 'two tabs = two timers (no sharing)');

  assert(ctx.hgTabAutoToggle('goldscalp') === 'off', 'disarming goldscalp → off');
  assert(B.cleared.length === 1, 'turn-off clears exactly one timer');
  assert(b1.textContent === 'AUTO-REFRESH 5m OFF' && b1.style.background === '', 'goldscalp paints OFF again');
  assert(b2.textContent === 'AUTO-REFRESH 5m ON', 'goldswing stays ON — independent state');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
