/* HARDGATE — tab-wiring integration test (Node 18+, builtins only).
   Emulates the browser classic-script environment in ONE vm context:
     1. loads the five support scripts (indicators, indicators2, store,
        binance, macro),
     2. loads the six feature-tab modules (squeeze, trendtable, oiflow,
        regime, carry, goldpro) and checks their window.HG_tabs registrations,
     3. extracts the three INLINE <script> blocks from index.html and runs
        them in order, exactly as the browser would,
     4. asserts the GROUPED two-tier nav: HG_NAV_GROUPS model (5 fixed groups,
        incl. not-yet-registered brain/strats/meanrev), dynamic tabs tagged into
        their group via HG_TAB_GROUP, row-2 buttons ordered by group sequence,
        group chips rendered, ≤2-click reachability, active-group persistence
        in localStorage, and showTab() lazy-mounting a tab exactly once while
        switching groups when the target lives elsewhere.
   A stub DOM (auto-vivifying getElementById) and a dead fetch stub keep
   everything offline; boot-time network calls fail fast and are tolerated.
   Run: node tests/test-tabs.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ---------------- harness ---------------- */
let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------------- stub DOM ---------------- */
function makeClassList(){
  const s = new Set();
  return {
    _set: s,
    add(){ for (const c of arguments) s.add(c); },
    remove(){ for (const c of arguments) s.delete(c); },
    toggle(c, force){
      const want = (force === undefined) ? !s.has(c) : !!force;
      if (want) s.add(c); else s.delete(c);
      return want;
    },
    contains(c){ return s.has(c); }
  };
}
function makeEl(tag){
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    id: '', innerHTML: '', textContent: '', value: '', className: '', type: '',
    disabled: false, checked: false, href: '', src: '', title: '', placeholder: '',
    style: {}, dataset: {}, children: [], parentNode: null,
    classList: makeClassList(),
    firstElementChild: { style: {} },
    _attrs: {}, _ev: {}, _qs: {},
    addEventListener(ev, fn){ (this._ev[ev] = this._ev[ev] || []).push(fn); },
    removeEventListener(){},
    appendChild(c){ this.children.push(c); c.parentNode = this; return c; },
    insertBefore(c, ref){
      const i = this.children.indexOf(ref);
      if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
      c.parentNode = this; return c;
    },
    removeChild(c){ const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    remove(){ if (this.parentNode) this.parentNode.removeChild(this); },
    setAttribute(k, v){ this._attrs[k] = String(v); },
    getAttribute(k){ return (k in this._attrs) ? this._attrs[k] : null; },
    querySelector(sel){
      if (!this._qs[sel]) this._qs[sel] = makeEl('div');
      return this._qs[sel];
    },
    querySelectorAll(){ return []; },
    insertAdjacentHTML(pos, html){ this.innerHTML += html; },
    focus(){}, blur(){}, click(){},
    getContext(){ return null; },
    cloneNode(){ return makeEl(this.tagName); },
    contains(){ return false; },
    offsetWidth: 0, offsetHeight: 0
  };
  return el;
}

const byId = new Map();
const navEl = makeEl('nav');
const mainEl = makeEl('main');

const documentStub = {
  getElementById(id){
    if (!byId.has(id)) byId.set(id, makeEl('div'));
    const el = byId.get(id);
    el.id = id;
    return el;
  },
  createElement(tag){ return makeEl(tag); },
  createTextNode(t){ return { textContent: String(t) }; },
  querySelector(sel){
    if (sel === 'nav') return navEl;
    if (sel === 'main') return mainEl;
    return makeEl('div');
  },
  querySelectorAll(){ return []; },
  addEventListener(){}, removeEventListener(){},
  body: makeEl('body'), head: makeEl('head'), documentElement: makeEl('html'),
  activeElement: null, title: '', hidden: false, visibilityState: 'visible'
};

/* Pre-seed the nav with a few static buttons the real page ships (plus an
   unknown 'dash' id on purpose) so we can assert group assignment, group-
   sequence ordering and the unassigned-buttons-fall-last rule. */
const staticNavIds = ['tabB_dash', 'tabB_coil', 'tabB_best'];
for (const id of staticNavIds){
  const b = makeEl('button'); b.id = id;
  byId.set(id, b);
  navEl.appendChild(b);
}

/* ---------------- stub browser globals ---------------- */
const storeMem = new Map();
const localStorageStub = {
  getItem(k){ return storeMem.has(k) ? storeMem.get(k) : null; },
  setItem(k, v){ storeMem.set(k, String(v)); },
  removeItem(k){ storeMem.delete(k); },
  clear(){ storeMem.clear(); }
};

function WebSocketStub(){ this.readyState = 0; }
WebSocketStub.OPEN = 1; WebSocketStub.CONNECTING = 0; WebSocketStub.CLOSING = 2; WebSocketStub.CLOSED = 3;
WebSocketStub.prototype.send = function(){};
WebSocketStub.prototype.close = function(){ this.readyState = 3; };
WebSocketStub.prototype.addEventListener = function(){};

const fetchStub = async () => ({ ok: false, status: 503, statusText: 'stubbed',
  json: async () => ({}), text: async () => '' });

/* window === the context global, exactly like a browser: anything a script
   sets on window becomes a bare global for the next script. */
const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  AbortController, queueMicrotask,
  document: documentStub,
  localStorage: localStorageStub,
  sessionStorage: localStorageStub,
  fetch: fetchStub,
  WebSocket: WebSocketStub,
  emailjs: { init(){}, send: async () => ({ status: 0, text: 'stubbed' }) },
  navigator: { clipboard: { writeText: async () => {} } },
  alert(){}, confirm(){ return true; }, prompt(){ return ''; },
  __mountLog: []
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);

/* ---------------- load scripts in browser order ---------------- */
function load(name){
  const code = readFileSync(path.join(root, name), 'utf8');
  vm.runInContext(code, ctx, { filename: name });
}

let loadErr = null;
try{
  ['indicators.js', 'indicators2.js', 'store.js', 'binance.js', 'macro.js'].forEach(load);
}catch(e){ loadErr = e; }
assert(!loadErr, 'support scripts load without throwing' + (loadErr ? ' — got: ' + loadErr.message : ''));

loadErr = null;
try{
  ['squeeze.js', 'trendtable.js', 'oiflow.js', 'regime.js', 'carry.js', 'goldpro.js'].forEach(load);
}catch(e){ loadErr = e; }
assert(!loadErr, 'six feature-tab modules load without throwing' + (loadErr ? ' — got: ' + loadErr.message : ''));

/* ---------------- HG_tabs registration ---------------- */
const EXPECTED = [
  ['squeeze', 'SQUEEZE'],
  ['trendmx', 'TREND MATRIX'],
  ['oiflow', 'OI FLOW'],
  ['regime', 'REGIME'],
  ['carry', 'CARRY'],
  ['goldpro', 'GOLD PRO']
];
const tabs = sandbox.HG_tabs;
assert(Array.isArray(tabs) && tabs.length === 6,
  'window.HG_tabs has exactly 6 registrations (got ' + (tabs && tabs.length) + ')');
assert(EXPECTED.every(([id, label], i) =>
  tabs[i] && tabs[i].id === id && tabs[i].label === label && typeof tabs[i].mount === 'function'),
  'HG_tabs order/ids/labels/mount match: ' + EXPECTED.map(e => e[0]).join(', '));
assert(new Set(tabs.map(t => t.id)).size === tabs.length, 'HG_tabs ids are unique');

/* each module mount() tolerates a bare stub element without sync throw */
for (const t of tabs){
  let threw = null;
  try { t.mount(makeEl('div')); } catch(e){ threw = e; }
  assert(!threw, 'mount() of tab "' + t.id + '" does not throw synchronously' + (threw ? ' — got: ' + threw.message : ''));
}

/* ---------------- inline blocks from index.html ---------------- */
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
const blocks = [];
let m;
while ((m = re.exec(html)) !== null){ if (m[1].trim()) blocks.push(m[1]); }
assert(blocks.length === 3, 'index.html yields exactly 3 non-empty inline <script> blocks (got ' + blocks.length + ')');

loadErr = null;
try{
  blocks.forEach((body, i) => vm.runInContext(body, ctx, { filename: 'index.html:inline-' + (i + 1) }));
}catch(e){ loadErr = e; }
assert(!loadErr, 'all 3 inline blocks execute (boot sequence included) without throwing'
  + (loadErr ? ' — got: ' + (loadErr && loadErr.stack ? loadErr.stack.split('\n').slice(0, 3).join(' | ') : loadErr) : ''));

/* ---------------- boot wiring assertions ---------------- */
const run = code => vm.runInContext(code, ctx);

assert(run('typeof showTab') === 'function', 'showTab is defined by inline code');
assert(run('typeof HG_TAB_MODS') === 'object' && run('Object.keys(HG_TAB_MODS).length') === 6,
  'HG_TAB_MODS filled with all 6 modules');
assert(EXPECTED.every(([id]) => run('HG_TAB_MODS[' + JSON.stringify(id) + '] && HG_TAB_MODS[' + JSON.stringify(id) + '].id') === id),
  'HG_TAB_MODS keyed by every module id');

/* ---------------- group model ---------------- */
const EXPECTED_GROUPS = {
  overview:   ['brain', 'execute', 'bias', 'regime', 'trendmx', 'rotation', 'news'],
  crypto:     ['swing', 'scalp', 'squeeze', 'smart', 'oiflow', 'liqs', 'onchain', 'coil', 'apex', 'trap', 'smc', 'ob', 'div'],
  gold:       ['gold', 'goldpro', 'goldspot'],
  strategies: ['strats', 'meanrev', 'best', 'carry'],
  tools:      ['basis', 'search', 'log', 'trade', 'finder']
};
assert(run('Array.isArray(HG_NAV_GROUPS)') === true && run('HG_NAV_GROUPS.length') === 5,
  'HG_NAV_GROUPS defines exactly 5 groups');
assert(run("HG_NAV_GROUPS.map(function(g){ return g.id; }).join(',')") === 'overview,crypto,gold,strategies,tools',
  'fixed group order: OVERVIEW → CRYPTO SCANS → GOLD → STRATEGIES → TOOLS');
assert(Object.keys(EXPECTED_GROUPS).every(gid =>
  run("HG_NAV_GROUPS.filter(function(g){ return g.id===" + JSON.stringify(gid) + "; })[0].tabs.join(',')") === EXPECTED_GROUPS[gid].join(',')),
  'group membership matches the spec (incl. not-yet-registered brain/strats/meanrev — groups render with missing ids)');
const ID2GROUP = { squeeze:'crypto', trendmx:'overview', oiflow:'crypto', liqs:'crypto', regime:'overview',
                   carry:'strategies', goldpro:'gold', strats:'strategies', meanrev:'strategies',
                   brain:'overview', execute:'overview', news:'overview', rotation:'overview', onchain:'crypto', goldspot:'gold' };
assert(Object.keys(ID2GROUP).every(id => run('HG_TAB_GROUP[' + JSON.stringify(id) + ']') === ID2GROUP[id]),
  'HG_TAB_GROUP maps every dynamic id into its group (brain/execute/news/squeeze/trendmx/oiflow/regime/carry/goldpro/strats/meanrev/rotation/onchain/goldspot)');

/* ---------------- registration mapping + row-2 layout ---------------- */
const navIds = navEl.children.map(c => c.id);
assert(EXPECTED.every(([id]) => navIds.indexOf('tabB_' + id) !== -1),
  'nav gained a button for every module: ' + navIds.join(', '));
assert(EXPECTED.every(([id]) => navEl.children[navIds.indexOf('tabB_' + id)].textContent === EXPECTED.find(e => e[0] === id)[1]),
  'nav button labels match module labels');
assert(EXPECTED.every(([id]) => {
  const b = navEl.children.filter(c => c.id === 'tabB_' + id)[0];
  return b && b.getAttribute('data-g') === ID2GROUP[id];
}), 'dynamic nav buttons registered INTO their group via data-g (not appended flat)');
assert(navEl.children.filter(c => c.id === 'tabB_coil')[0].getAttribute('data-g') === 'crypto'
    && navEl.children.filter(c => c.id === 'tabB_best')[0].getAttribute('data-g') === 'strategies',
  'static buttons tagged with their groups too (coil→crypto, best→strategies)');
const EXPECTED_ORDER = ['tabB_regime', 'tabB_trendmx', 'tabB_squeeze', 'tabB_oiflow', 'tabB_coil',
                        'tabB_goldpro', 'tabB_best', 'tabB_carry', 'tabB_dash'];
assert(navIds.join(',') === EXPECTED_ORDER.join(','),
  'row-2 buttons ordered by group sequence, then group tab order (unassigned last): ' + navIds.join(', '));

/* panes appended to <main> as .tabpane with matching ids */
const paneIds = mainEl.children.map(c => c.id);
assert(EXPECTED.every(([id]) => {
  const i = paneIds.indexOf('tab_' + id);
  return i !== -1 && mainEl.children[i].className === 'tabpane';
}), 'main gained a .tabpane pane for every module: ' + paneIds.join(', '));

/* ---------------- group chips ---------------- */
const chipsRow = documentStub.getElementById('navGroups');
assert(chipsRow.children.length === 5, 'group row renders all 5 group chips even though member tabs are missing');
assert(chipsRow.children.map(c => c.getAttribute('data-g')).join(',') === 'overview,crypto,gold,strategies,tools',
  'chips follow the fixed group order');
assert(chipsRow.children.filter(c => c.classList.contains('on')).length === 1
    && chipsRow.children[0].classList.contains('on'),
  'exactly one active chip (OVERVIEW by default)');

/* ---------------- ≤2-click reachability ---------------- */
assert(navEl.children.every(c => {
  const g = c.getAttribute('data-g');
  return !g || (EXPECTED_GROUPS[g] && EXPECTED_GROUPS[g].indexOf(c.id.slice(5)) !== -1);
}), 'every nav button lives in exactly one chip group → reachable in ≤2 clicks (group chip, then tab)');
assert(EXPECTED.every(([id]) => Object.keys(EXPECTED_GROUPS).some(g => EXPECTED_GROUPS[g].indexOf(id) !== -1)),
  'every dynamic module id is reachable through a group');

/* default paint: OVERVIEW active */
assert(navEl.children.filter(c => c.id === 'tabB_regime')[0].style.display !== 'none',
  'OVERVIEW tabs visible by default');
assert(navEl.children.filter(c => c.id === 'tabB_squeeze')[0].style.display === 'none',
  'CRYPTO tabs hidden while OVERVIEW is active');
assert(navEl.children.filter(c => c.id === 'tabB_dash')[0].style.display !== 'none',
  'unassigned buttons stay visible regardless of group');

/* ---------------- group switching + persistence ---------------- */
run("setHgGroup('crypto', false)");
assert(run('HG_GROUP') === 'crypto', 'setHgGroup switches the active group');
assert(storeMem.get('hg_active_group') === 'crypto', 'active group persisted to localStorage(hg_active_group)');
assert(navEl.children.filter(c => c.id === 'tabB_squeeze')[0].style.display !== 'none'
    && navEl.children.filter(c => c.id === 'tabB_regime')[0].style.display === 'none',
  'row-2 visibility follows the active group');
assert(chipsRow.children[1].classList.contains('on') && !chipsRow.children[0].classList.contains('on'),
  'chip highlight follows the active group');

/* persisted group restored at boot; invalid values fall back to OVERVIEW */
storeMem.set('hg_active_group', 'gold');
run('hgBootNav()');
assert(run('HG_GROUP') === 'gold', 'hgBootNav restores the persisted active group (gold)');
assert(chipsRow.children.length === 5, 'chip re-render is idempotent (still 5 chips)');
storeMem.set('hg_active_group', 'bogus-group');
run('hgBootNav()');
assert(run('HG_GROUP') === 'overview', 'invalid persisted group falls back to OVERVIEW');

/* showTab: lazy-mount on first open, exactly once */
run('HG_TAB_MODS.squeeze = { id:"squeeze", label:"SQUEEZE", mount:function(el){ window.__mountLog.push(el && el.id); } };');
run("showTab('squeeze')");
assert(sandbox.__mountLog.length === 1 && sandbox.__mountLog[0] === 'tab_squeeze',
  'first showTab("squeeze") lazy-mounts with the tab_squeeze pane element');
run("showTab('squeeze')");
assert(sandbox.__mountLog.length === 1, 'second showTab("squeeze") does NOT re-mount (HG_MOUNTED latch)');
assert(run('HG_MOUNTED.squeeze') === true, 'HG_MOUNTED.squeeze latched true');

/* a real module mount through showTab does not throw either */
let realMountErr = null;
try { run("showTab('regime')"); } catch(e){ realMountErr = e; }
assert(!realMountErr, 'showTab("regime") mounts the real module without throwing'
  + (realMountErr ? ' — got: ' + realMountErr.message : ''));
assert(run('HG_MOUNTED.regime') === true, 'HG_MOUNTED.regime latched after real mount');

/* static tabs never touch HG_TAB_MODS */
let staticErr = null;
try { run("showTab('best')"); } catch(e){ staticErr = e; }
assert(!staticErr, 'showTab("best") (static tab) works and mounts nothing dynamic');

/* showTab switches the active group when the target tab lives elsewhere —
   existing call sites (toTrade, card handoffs) keep working unchanged */
run("setHgGroup('overview', false)");
run("showTab('best')");
assert(run('HG_GROUP') === 'strategies', 'showTab("best") auto-switches OVERVIEW → STRATEGIES');
assert(storeMem.get('hg_active_group') === 'strategies', 'showTab-driven group switch persists too');

/* a group chip click shows its tabs AND auto-opens the first AVAILABLE one —
   strats/meanrev are not registered yet, so STRATEGIES opens BEST */
run("window.__shown = []; showTab = function(t){ window.__shown.push(t); };");
const stratChip = chipsRow.children.filter(c => c.getAttribute('data-g') === 'strategies')[0];
assert(stratChip && Array.isArray(stratChip._ev.click) && stratChip._ev.click.length === 1,
  'group chip carries a click handler');
stratChip._ev.click.forEach(fn => fn());
assert(sandbox.__shown.length === 1 && sandbox.__shown[0] === 'best',
  'chip click auto-opens first available tab (strats/meanrev skipped gracefully → BEST)');
assert(run('HG_GROUP') === 'strategies' && chipsRow.children[3].classList.contains('on'),
  'chip click activates its group + highlight');

/* ---------------- settle & summary ---------------- */
process.on('unhandledRejection', () => {}); /* boot-time fetches fail by design */
await new Promise(r => setTimeout(r, 400)); /* let boot promises flush against the dead fetch stub */

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
console.log('ALL TAB-WIRING TESTS PASSED');
process.exit(0); /* boot setIntervals would otherwise keep the loop alive */
