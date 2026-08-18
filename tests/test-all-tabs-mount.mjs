/* HARDGATE — every tab, mounted and refreshed, with nothing available.

   The suite had 211 files and not one of them MOUNTED a tab. Every test
   exercised pure functions: detectors, gates, the forward log, the plan
   engine. The thing a user actually does — open a tab — was covered nowhere,
   across fifty-two of them.

   That is the gap this closes. Each tab is mounted into a simulated DOM and
   refreshed with:

     no network        fetch rejects
     no localStorage   every read returns null
     no other tab      only what the module itself registered

   which is the worst honest case: a cold browser, offline. A tab that throws
   here throws on someone's first visit, and because HG_tabs entries are
   invoked by the shell rather than by each other, one throwing mount can take
   the shell's render loop with it.

   This is a SMOKE test and says so. It proves a tab comes up and does not
   explode; it says nothing about whether what it renders is correct. Those
   are separate tests, and the desks have them.

   Run: node tests/test-all-tabs-mount.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

/* A DOM stub with just enough surface that a tab can build its panel. Deliberately
   minimal: anything a tab needs beyond this, it should feature-check. */
function mkEl(tag){
  const kids = [];
  const e = {
    tagName: (tag || 'div').toUpperCase(), style: {}, dataset: {}, attrs: {}, children: kids,
    _html: '', value: '', checked: false, disabled: false, textContent: '',
    scrollTop: 0, offsetWidth: 100, offsetHeight: 100,
    appendChild(c){ kids.push(c); return c; }, removeChild(){}, insertBefore(c){ kids.push(c); return c; },
    setAttribute(k, v){ e.attrs[k] = v; }, getAttribute(k){ return k in e.attrs ? e.attrs[k] : null; },
    removeAttribute(k){ delete e.attrs[k]; }, hasAttribute(k){ return k in e.attrs; },
    addEventListener(){}, removeEventListener(){}, remove(){}, click(){}, focus(){}, blur(){},
    querySelector(){ return mkEl('div'); }, querySelectorAll(){ return []; },
    closest(){ return null; }, contains(){ return false; }, insertAdjacentHTML(){},
    getBoundingClientRect(){ return { top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 }; },
    classList: { add(){}, remove(){}, toggle(){}, contains: () => false },
    getContext(){ return { fillRect(){}, clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){},
      fill(){}, arc(){}, save(){}, restore(){}, translate(){}, scale(){}, setTransform(){}, fillText(){},
      measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop(){} }) }; }
  };
  Object.defineProperty(e, 'innerHTML', { get(){ return e._html; }, set(v){ e._html = String(v); } });
  Object.defineProperty(e, 'firstChild', { get(){ return kids[0] || null; } });
  return e;
}

function boot(){
  const ctx = { console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object, Number, String,
    Promise, RegExp, setTimeout, clearTimeout, setInterval, clearInterval, Intl,
    encodeURIComponent, decodeURIComponent, AbortController, TypeError, Error, Map, Set, Symbol,
    requestAnimationFrame: (f) => setTimeout(f, 0) };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  /* Every storage read returns null — a browser that has never run this app. */
  ctx.localStorage = { getItem: () => null, setItem(){}, removeItem(){}, clear(){} };
  ctx.sessionStorage = ctx.localStorage;
  ctx.document = { createElement: mkEl, createTextNode: () => mkEl('span'),
    createDocumentFragment: () => mkEl('div'), getElementById: () => mkEl('div'),
    querySelector: () => mkEl('div'), querySelectorAll: () => [],
    head: mkEl('head'), body: mkEl('body'), documentElement: mkEl('html'),
    addEventListener(){}, removeEventListener(){}, visibilityState: 'visible', readyState: 'complete' };
  ctx.fetch = () => Promise.reject(new Error('no network in mount test'));
  ctx.navigator = { userAgent: 'node', onLine: false, clipboard: { writeText: () => Promise.resolve() } };
  ctx.location = { href: 'http://localhost/', search: '', hash: '', protocol: 'http:', host: 'localhost', reload(){} };
  ctx.CustomEvent = function(){}; ctx.Event = function(){};
  vm.createContext(ctx);
  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.js') && f !== 'sw.js').sort();
  const failed = [];
  for (const f of files){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e){ failed.push(f + ': ' + String(e.message).slice(0, 60)); }
  }
  return { ctx, files, failed };
}

const { ctx, files, failed } = boot();

console.log('== every browser module parses and runs ==');
{
  /* app.js is the ESM daemon and is not a browser script — it is the only
     file expected to fail here, and naming it means a NEW failure cannot hide
     behind a vague count. */
  ok(files.length > 100, 'the app has ' + files.length + ' javascript modules');
  ok(failed.length <= 1, 'at most one fails to run as a browser script (' + failed.length + ')');
  if (failed.length){
    ok(/^app\.js/.test(failed[0]), 'and it is app.js, the ESM daemon — not a tab (' + failed[0] + ')');
  }
}

console.log('\n== the tab registry is coherent ==');
{
  const tabs = ctx.HG_tabs;
  ok(tabs.length >= 50, 'tabs registered: ' + tabs.length);
  ok(tabs.every(t => t && typeof t.id === 'string' && t.id), 'every entry has an id');
  ok(tabs.every(t => typeof t.mount === 'function'), 'every entry has a mount');
  ok(tabs.every(t => typeof t.refresh === 'function'), 'every entry has a refresh');
  /* A duplicate id means one tab silently shadows another in the shell. */
  const ids = tabs.map(t => t.id);
  const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  ok(dupes.length === 0, 'no duplicate tab ids' + (dupes.length ? ' — ' + dupes.join(', ') : ''));
  ok(tabs.every(t => typeof t.label === 'string' || t.label === undefined),
     'labels are strings where present');
}

/* ONE pass over the tabs, not four.

   Mounting fifty-two tabs is the expensive part — several build large panels
   and some warm caches — and doing it once per assertion took 6m40s, which is
   not a test anyone will keep running. Every per-tab check now happens in a
   single loop and the failures are collected, so the assertions below report
   on work that was done once. */
const mountFails = [], refreshFails = [], remountFails = [], blank = [];
for (const t of ctx.HG_tabs){
  const el = mkEl('div');
  try { t.mount(el); }
  catch (e){ mountFails.push(t.id + ' :: ' + String(e.message).slice(0, 70)); continue; }

  /* A tab that renders nothing is invisible in the shell. */
  const text = String(el.innerHTML || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) blank.push(t.id);

  /* The shell re-mounts on navigation. A tab that assumes it mounts once —
     appending a style element, or registering on a module variable — breaks
     the second time a user opens it. */
  try { t.mount(mkEl('div')); }
  catch (e){ remountFails.push(t.id + ' :: ' + String(e.message).slice(0, 70)); }

  try {
    const r = t.refresh();
    /* An async refresh may REJECT on the dead network, which is expected.
       What must not happen is a synchronous throw. */
    if (r && typeof r.then === 'function') r.catch(() => {});
  }
  catch (e){ refreshFails.push(t.id + ' :: ' + String(e.message).slice(0, 70)); }
}

console.log('\n== every tab MOUNTS on a cold, offline browser ==');
ok(mountFails.length === 0, 'all ' + ctx.HG_tabs.length + ' tabs mount without throwing'
  + (mountFails.length ? '\n     ' + mountFails.join('\n     ') : ''));

console.log('\n== and REFRESHES without throwing ==');
ok(refreshFails.length === 0, 'all ' + ctx.HG_tabs.length + ' tabs refresh without throwing'
  + (refreshFails.length ? '\n     ' + refreshFails.join('\n     ') : ''));

console.log('\n== mounting twice is safe ==');
ok(remountFails.length === 0, 'every tab survives a second mount'
  + (remountFails.length ? '\n     ' + remountFails.join('\n     ') : ''));

console.log('\n== a tab that renders nothing at all would be invisible ==');
ok(blank.length === 0, 'every tab renders something on mount'
  + (blank.length ? ' — blank: ' + blank.join(', ') : ''));

console.log('\n== refresh does not need a prior mount to be safe ==');
{
  /* The shell can refresh a background tab. This needs a context where
     nothing has mounted, so it is the one place a second boot is justified —
     and it only calls refresh, never mount. */
  const { ctx: fresh } = boot();
  const fails = [];
  for (const t of fresh.HG_tabs){
    try {
      const r = t.refresh();
      if (r && typeof r.then === 'function') r.catch(() => {});
    }
    catch (e){ fails.push(t.id + ' :: ' + String(e.message).slice(0, 70)); }
  }
  ok(fails.length === 0, 'refresh before mount is safe on every tab'
    + (fails.length ? '\n     ' + fails.join('\n     ') : ''));
}

console.log('\n' + passed + ' passed, 0 failed');
console.log('ALL TAB MOUNT TESTS PASSED');

/* Mounting a tab schedules real background work — poll timers, retry loops,
   warm-up intervals — which is correct for a live app and keeps Node's event
   loop alive long after the assertions are done. Measured: 0.9s of CPU inside
   an 8m20s wall clock, all of it idling on timers that will never resolve
   against a dead network. The assertions above are complete by this line, so
   the process stops here rather than waiting them out. */
process.exit(0);
