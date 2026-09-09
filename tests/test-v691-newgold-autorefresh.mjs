/* v691: NEW GOLD tab auto-refreshes every 5 minutes while mounted.

   RSI cross detection lives on closed-bar semantics but intra-bar
   price motion still moves through FVG zones and updates the ML
   baseline, so a 5-minute re-scan keeps the trigger window responsive
   without waiting for a full 1H/4H bar close.

   Pattern mirrors omnigold's __og.__uniTimer: timer starts only on
   MOUNT (not module load) so Node test processes never hang on a
   stray interval. Timer is stored on module state so a subsequent
   mount clears the prior timer instead of stacking. Timer self-heals
   when the mount element is removed from the document. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const { HG_VER } = await import('./helpers/build-version.mjs');

/* --- structural asserts --- */
const src = readFileSync(resolve(ROOT, 'newgold.js'), 'utf8');
assert.ok(/var NG_AUTO_REFRESH_MS = 5 \* 60 \* 1000;/.test(src),
  '5-minute refresh cadence constant');
assert.ok(/v691: auto-refresh cadence/.test(src),
  'v691 rationale comment at cadence constant');
assert.ok(/__timer: null, __mountEl: null/.test(src),
  'timer + mountEl fields on module state');
assert.ok(/v691: auto-refresh every 5 minutes while the tab is mounted/.test(src),
  'v691 mount rationale comment');
assert.ok(/setInterval\(function\(\)\{/.test(src),
  'setInterval wired at mount');
assert.ok(/clearInterval\(__ng\.__timer\)/.test(src),
  'clearInterval used to prevent timer stacking');
assert.ok(/document\.body\.contains\(__ng\.__mountEl\)/.test(src),
  'self-heal on unmount: check document.body.contains');
assert.ok(/typeof setInterval === 'function'/.test(src),
  'setInterval feature-checked (works in Node harness without DOM)');

/* --- self-healing pattern: check the timer clears + nulls both fields --- */
assert.ok(
  /if \(__ng\.__mountEl && !document\.body\.contains\(__ng\.__mountEl\)\)\{[\s\S]{0,400}?clearInterval\(__ng\.__timer\);\s*\n\s*__ng\.__timer = null;\s*\n\s*__ng\.__mountEl = null;/.test(src),
  'self-heal: clear interval + null both fields on unmount detection');

/* --- calls the SAME runScan as the button --- */
assert.ok(/try \{ runScan\(\); \} catch\(eTick\)\{\}/.test(src),
  'tick calls same runScan as button click');

/* --- guard: does not start a timer at module load --- */
/* The IIFE at module load only defines fns and calls the tab-register
   push at end. No setInterval should run at load. Assert by checking
   setInterval only appears INSIDE the mount() function, not top-level. */
{
  const mountFn = src.match(/function mount\(el\)\{[\s\S]*?\n\}/);
  assert.ok(mountFn, 'mount function extracted');
  assert.ok(/setInterval/.test(mountFn[0]),
    'setInterval is inside mount() (not module top-level)');
  /* Count setInterval occurrences; should be exactly one, inside mount. */
  const setIntervalCount = (src.match(/setInterval/g) || []).length;
  /* One inside mount function body + one in the typeof check inside the same block = 2 mentions. */
  assert.ok(setIntervalCount <= 3,
    'setInterval only appears in mount() flow (' + setIntervalCount + ' mentions)');
}

/* --- runtime: evaluate IIFE with a fake window/globalThis, confirm no
   timer is set at load. Override BOTH global setInterval (called via
   bare identifier inside the IIFE) so the tracking is faithful. */
{
  const fakeW = {};
  let setIntervalCalls = 0;
  const trackedSet = function(){ setIntervalCalls++; return 42; };
  fakeW.setInterval = trackedSet;
  new Function('window', 'setInterval', 'clearInterval', 'document', `
    var globalThis = window;
    ${src}
    return window;
  `)(fakeW, trackedSet, function(){}, {});
  assert.equal(setIntervalCalls, 0,
    'module load must NOT call setInterval (only mount does)');
}

/* --- runtime: mounting DOES schedule the interval --- */
{
  const fakeW = {};
  const intervals = [];
  const fakeSetInterval = function(fn, ms){ intervals.push({ fn, ms }); return intervals.length; };
  let clears = 0;
  const fakeClearInterval = function(){ clears++; };
  /* Fake DOM stub that returns dummy elements for any selector so
     runScan (auto-invoked on mount) does not crash when it looks up
     #ngCards, #ngStat, etc. */
  function stubEl(){
    return {
      innerHTML: '',
      textContent: '',
      className: '',
      style: {},
      firstElementChild: null,
      disabled: false,
      addEventListener(){},
      querySelector(){ return stubEl(); }
    };
  }
  const rootEl = {
    _children: {},
    innerHTML: '',
    querySelector(){ return stubEl(); },
    addEventListener(){}
  };
  const fakeDocument = {
    body: { contains(el){ return el === rootEl; } },
    querySelector(){ return null; }
  };
  fakeW.setInterval = fakeSetInterval;
  fakeW.clearInterval = fakeClearInterval;
  fakeW.document = fakeDocument;
  const api = new Function('window', 'setInterval', 'clearInterval', 'document', `
    var globalThis = window;
    ${src}
    return { tabs: window.HG_tabs, run: window.ngRunScan };
  `)(fakeW, fakeSetInterval, fakeClearInterval, fakeDocument);
  const newGoldTab = (api.tabs || []).find(function(t){ return t.id === 'newgold'; });
  assert.ok(newGoldTab, 'newgold tab registered');
  /* Call mount with a fake element */
  newGoldTab.mount(rootEl);
  assert.equal(intervals.length, 1, 'mount schedules exactly one interval');
  assert.equal(intervals[0].ms, 5 * 60 * 1000, 'interval cadence = 5 minutes');
  /* Second mount clears the first and schedules again */
  newGoldTab.mount(rootEl);
  assert.equal(intervals.length, 2, 'second mount schedules again');
  assert.ok(clears >= 1, 'second mount cleared the prior timer');
  /* Interval body should be a function */
  assert.equal(typeof intervals[0].fn, 'function');
}

/* --- version + cache-buster --- */
assert.ok(/^hg-v(?:691|69[2-9]|[7-9]\d\d|\d{4,})$/.test(HG_VER) && HG_VER >= 'hg-v691',
  'HG_VER must be >= hg-v691 (merge with concurrent hg-v645 bumped to v692)');
const sw = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
assert.ok(new RegExp("HG_CACHE\\s*=\\s*'" + HG_VER + "'").test(sw));
const idx = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const qv = HG_VER.replace(/^hg-v/, '');
assert.ok(new RegExp('newgold\\.js\\?v=' + qv).test(idx),
  'index.html newgold.js cache-buster = ?v=' + qv);

console.log('OK - v691: NEW GOLD auto-refresh every 5 minutes on mount');
console.log('  * cadence constant NG_AUTO_REFRESH_MS = 5 * 60 * 1000');
console.log('  * timer + mountEl fields on module state');
console.log('  * setInterval only inside mount() (not module load)');
console.log('  * clearInterval prevents timer stacking on remount');
console.log('  * self-heals when mount element leaves DOM');
console.log('  * tick calls the same runScan as manual click');
console.log('  * runtime: module load does not touch setInterval');
console.log('  * runtime: mount schedules 5-min interval; remount clears + reschedules');
console.log('  * version bumped to ' + HG_VER);
