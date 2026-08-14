/* HARDGATE — hardRefreshAll integration test (Node 18+, builtins only).
   Same vm-based classic-script emulation as test-tabs.mjs: support scripts +
   feature modules + the inline blocks of index.html run in ONE context.
   Covers the HARD REFRESH rewrite:
     1. nav wiring — onchain.js / rotation.js / goldspot.js <script src> tags
        land after news.js, and HG_NAV_GROUPS place rotation (overview, after
        trendmx), onchain (crypto, after liqs), goldspot (gold, last);
     2. hardRefreshAll refreshes the 16 inline tasks (incl. the previously
        missing SMART / GOLD DEEP / GOLD SETUP) AND every HG_TAB_MODS entry
        exposing refresh() — each awaited in its own try-catch;
     3. a throwing inline task and a throwing module refresher never stop the
        loop and count as failed; status strings starting with 'skip'/'busy'
        count as skipped; the chip reports honest refreshed/skipped/failed
        counts plus a failed-names title — never a blanket 'all refreshed';
     4. re-entrancy — a second invocation while one is running is a no-op with
        a chip note, and the busy flag is released afterwards.
   The HG_TAB_MODS registry is CLEARED and re-seeded with fake modules so the
   counts stay deterministic regardless of what real module refresh() bodies
   do against the dead fetch stub.
   Run: node tests/test-hard-refresh.mjs */

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

/* ---------------- stub DOM (same shape as test-tabs.mjs) ---------------- */
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
  __calls: {}, __refreshLog: []
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);

/* ---------------- load scripts in browser order ---------------- */
function load(name){
  const code = readFileSync(path.join(root, name), 'utf8');
  vm.runInContext(code, ctx, { filename: name });
}
const run = code => vm.runInContext(code, ctx);

let loadErr = null;
try{
  ['indicators.js', 'indicators2.js', 'store.js', 'binance.js', 'macro.js',
   'squeeze.js', 'trendtable.js', 'oiflow.js', 'regime.js', 'carry.js', 'goldpro.js'].forEach(load);
}catch(e){ loadErr = e; }
assert(!loadErr, 'support + feature scripts load without throwing' + (loadErr ? ' — got: ' + loadErr.message : ''));

const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
const blocks = [];
let m;
while ((m = re.exec(html)) !== null){ if (m[1].trim()) blocks.push(m[1]); }

loadErr = null;
try{
  blocks.forEach((body, i) => vm.runInContext(body, ctx, { filename: 'index.html:inline-' + (i + 1) }));
}catch(e){ loadErr = e; }
assert(!loadErr, 'inline blocks execute without throwing'
  + (loadErr ? ' — got: ' + (loadErr && loadErr.stack ? loadErr.stack.split('\n').slice(0, 3).join(' | ') : loadErr) : ''));

/* ---------------- 1. nav wiring: new module <script src> tags ---------------- */
const tagOf = f => '<script src="' + f + '"></script>';
const iNews = html.indexOf(tagOf('news.js'));
const iOnchain = html.indexOf(tagOf('onchain.js'));
const iRotation = html.indexOf(tagOf('rotation.js'));
const iGoldspot = html.indexOf(tagOf('goldspot.js'));
assert(iNews !== -1 && iOnchain !== -1 && iRotation !== -1 && iGoldspot !== -1,
  'index.html includes <script src> tags for onchain.js, rotation.js, goldspot.js');
assert(iNews < iOnchain && iOnchain < iRotation && iRotation < iGoldspot,
  'new module tags load after news.js in order: onchain → rotation → goldspot');

/* ---------------- 1b. nav wiring: group membership ---------------- */
const groupTabs = gid => run("HG_NAV_GROUPS.filter(function(g){ return g.id===" + JSON.stringify(gid) + "; })[0].tabs.join(',')");
assert(groupTabs('overview') === 'brain,book,trade,log,news,bias,regime,trendmx,rotation,execute,startrader',
  'COMMAND group: workflow then context');
assert(groupTabs('crypto') === 'best,swing,scalp,edge,smart,squeeze,reversalsniper,smc,ob,trap,div,coil,apex,oiflow,liqs,onchain,chartvision,carry,venueprem,termbasis',
  'CRYPTO group: ranked scans → structure → flow → funding');
assert(groupTabs('gold') === 'super-gold,goldswing,goldscalp,gold,goldpro,goldspot,goldcoint,goldpine,signallog',
  'GOLD group: super desk first, then scanners');
assert(run("HG_TAB_GROUP.rotation") === 'overview' && run("HG_TAB_GROUP.onchain") === 'crypto'
    && run("HG_TAB_GROUP.goldspot") === 'gold',
  'HG_TAB_GROUP maps rotation→overview, onchain→crypto, goldspot→gold');

/* ---------------- 2. stub the 16 inline refresh targets ---------------- */
const INLINE_FNS = ['runMarketPictureUI','runBias','runGold','runBest','runCoilScan','runApexScan',
                    'runTrapScan','runSmcScan','runObScan','runDivScan','runBasisScan',
                    'runSmartScan','runGoldDeep','runGoldSetup'];
sandbox.__stubs = {};
const bump = key => { sandbox.__calls[key] = (sandbox.__calls[key] || 0) + 1; };
for (const n of INLINE_FNS){ sandbox.__stubs[n] = async function(){ bump(n); }; }
sandbox.__stubs.runScan = async function(kind){ bump('runScan:' + kind); };
sandbox.__stubs.runCoilScan = async function(){ bump('runCoilScan'); throw new Error('coil down'); };
run(INLINE_FNS.map(n => n + ' = window.__stubs.' + n + ';').join('\n') + '\nrunScan = window.__stubs.runScan;');
/* swapping a stub later must ALSO rebind the inline global — the earlier
   assignment copied the function reference, it does not track __stubs */
const setStub = (name, fn) => { sandbox.__stubs[name] = fn; run(name + ' = window.__stubs.' + name + ';'); };

/* ---------------- 2b. re-seed HG_TAB_MODS with fake refreshers ---------------- */
const mkMod = (id, label, refresh) => {
  const mod = { id, label, mount(){} };
  if (refresh) mod.refresh = refresh;
  return mod;
};
run("Object.keys(HG_TAB_MODS).forEach(function(k){ delete HG_TAB_MODS[k]; });");
sandbox.__fakeMods = [
  mkMod('modOk',    'MOD OK',   async function(){ sandbox.__refreshLog.push('modOk'); return 'refreshed'; }),
  mkMod('modSkip',  'MOD SKIP', async function(){ sandbox.__refreshLog.push('modSkip'); return 'skipped: not run yet'; }),
  mkMod('modBusy',  'MOD BUSY', async function(){ sandbox.__refreshLog.push('modBusy'); return 'busy'; }),
  mkMod('modBoom',  'MOD BOOM', async function(){ sandbox.__refreshLog.push('modBoom'); throw new Error('boom'); }),
  mkMod('modAfter', 'MOD AFTER',async function(){ sandbox.__refreshLog.push('modAfter'); return 'refreshed'; }),
  mkMod('modPlain', 'MOD PLAIN', null) /* no refresh field — must be ignored */
];
run("window.__fakeMods.forEach(function(mod){ HG_TAB_MODS[mod.id] = mod; });");

/* ---------------- 3. drive hardRefreshAll ---------------- */
assert(run('typeof hardRefreshAll') === 'function', 'hardRefreshAll is defined by inline code');
const chip = documentStub.getElementById('hardRefreshStat');
const btn = documentStub.getElementById('hardRefreshBtn');
chip.textContent = ''; chip.title = '';

await run('hardRefreshAll()');

assert(INLINE_FNS.every(n => (sandbox.__calls[n] || 0) === 1),
  'all 16 inline tasks ran exactly once (incl. SMART runSmartScan, GOLD DEEP runGoldDeep, GOLD SETUP runGoldSetup)');
assert((sandbox.__calls['runScan:swing'] || 0) === 1 && (sandbox.__calls['runScan:scalp'] || 0) === 1,
  'runScan driven for both swing and scalp');
assert(sandbox.__refreshLog.join(',') === 'modOk,modSkip,modBusy,modBoom,modAfter',
  'every module refresh() awaited in registry order — a throwing refresher (modBoom) does NOT stop the loop');

/* counts: inline 15 refreshed + 1 failed (COIL); modules modOk+modAfter refreshed,
   modSkip+modBusy skipped, modBoom failed; modPlain ignored */
assert(/^refreshed 18 · skipped 2 · failed 2 · \d{2}:\d{2}:\d{2}$/.test(chip.textContent),
  'chip reports honest refreshed/skipped/failed counts + timestamp — got: "' + chip.textContent + '"');
assert(chip.textContent.indexOf('all tabs refreshed') === -1 && chip.textContent.indexOf('all refreshed') === -1,
  'chip never claims "all refreshed" while failures exist');
assert(chip.title === 'failed: COIL, MOD BOOM',
  'chip title lists the failed task names (inline + module) — got: "' + chip.title + '"');
assert(btn.disabled === false, 'refresh button re-enabled after the run');
assert(run('HG_REFRESH_BUSY') === false, 'module-level busy flag released after the run');

/* a clean run (no failures) reports failed 0 and a "no failures" title */
setStub('runCoilScan', async function(){ bump('runCoilScan'); });
run("HG_TAB_MODS.modBoom.refresh = async function(){ window.__refreshLog.push('modBoom'); return 'refreshed'; };");
chip.textContent = ''; chip.title = '';
await run('hardRefreshAll()');
assert(/^refreshed 20 · skipped 2 · failed 0 · \d{2}:\d{2}:\d{2}$/.test(chip.textContent),
  'clean run reports failed 0 accurately — got: "' + chip.textContent + '"');
assert(chip.title === 'no failures', 'clean run chip title admits no failures');

/* ---------------- 4. re-entrancy: overlapping invocation is a no-op ---------------- */
let releaseGate;
sandbox.__gate = new Promise(r => { releaseGate = r; });
setStub('runMarketPictureUI', async function(){ bump('runMarketPictureUI'); await sandbox.__gate; });
const before = sandbox.__calls.runMarketPictureUI;
const logBefore = sandbox.__refreshLog.length;

const p1 = run('hardRefreshAll()');            /* starts, parks on the gated first task */
const noopRet = await run('hardRefreshAll()'); /* must no-op while p1 is running */
assert(noopRet === undefined, 'overlapping invocation returns immediately (no-op)');
assert(chip.textContent.indexOf('already running') !== -1,
  'overlapping invocation leaves an honest chip note — got: "' + chip.textContent + '"');
assert((sandbox.__calls.runMarketPictureUI || 0) === before + 1,
  'gated first task started exactly once (no double-fetch from the overlap)');
releaseGate();
await p1;
assert((sandbox.__calls.runMarketPictureUI || 0) === before + 1,
  'first task still ran exactly once after gate release');
assert(sandbox.__refreshLog.length === logBefore + 5,
  'module refreshers ran exactly once for the real run (overlap added none)');
assert(run('HG_REFRESH_BUSY') === false && btn.disabled === false,
  'busy flag + button released after the overlapped run completes');

/* busy guard works again on the NEXT run (flag not stuck) */
chip.textContent = '';
await run('hardRefreshAll()');
assert(/^refreshed 20 · skipped 2 · failed 0 · /.test(chip.textContent),
  'subsequent run executes normally — busy flag not stuck');

/* ---------------- 5. theme wiring: bright.css linked + precached ---------------- */
const iStyleEnd = html.indexOf('</style>');
const iBright = html.indexOf('<link rel="stylesheet" href="bright.css">');
assert(iStyleEnd !== -1 && iBright !== -1 && iStyleEnd < iBright && iBright < html.indexOf('</head>'),
  'bright.css <link> lands after the inline </style> block, inside <head>');
const swSrc = readFileSync(path.join(root, 'sw.js'), 'utf8');
assert(/HG_CACHE\s*=\s*'hg-v\d+'/.test(swSrc), 'service worker cache name is hg-vN (clients pick up the new shell)');
assert(swSrc.indexOf("'./bright.css'") !== -1, 'bright.css added to the HG_SHELL precache list');
assert(swSrc.indexOf("'./hg-icons.css'") !== -1, 'hg-icons.css added to the HG_SHELL precache list');

/* ---------------- 6. auto-refresh control: hard-coded 2m ---------------- */
const iHrdBtn = html.indexOf('id="hardRefreshBtn"');
const iAuto = html.indexOf('id="autoRefreshCtl"');
const iHrdStat = html.indexOf('id="hardRefreshStat"');
assert(iHrdBtn !== -1 && iAuto !== -1 && iHrdBtn < iAuto,
  'AUTO segmented control renders in the header after #hardRefreshBtn');
assert(iAuto < iHrdStat,
  'AUTO control sits immediately after the button (before the refresh status chip)');
['autoRefOff','autoRef120000','autoRef180000','autoRef300000','autoRef900000','autoRefreshCount'].forEach(function(id){
  assert(html.indexOf('id="' + id + '"') !== -1, 'header contains #' + id);
});
const autoCount = documentStub.getElementById('autoRefreshCount');
assert(run('HG_AUTO_MS') === 120000 && storeMem.get('hgAutoRefresh') === '120000',
  'auto refresh hard-locked to 2m after hgAutoInit on load');
assert(run("document.getElementById('autoRef120000').classList.contains('on')") === true,
  '2m segment is painted active by default when hard-coded');
assert(autoCount.style.display !== 'none', 'countdown chip visible while hard-coded 2m');
assert(run('HG_AUTO_TIMER !== null') === true, 'interval lives while hard-coded 2m');

/* ---------------- 7. choice → interval mapping + persistence ---------------- */
run("setAutoRefresh('120000')");
assert(run('HG_AUTO_MS') === 120000 && storeMem.get('hgAutoRefresh') === '120000',
  '2m maps to 120000ms and persists to localStorage');
assert(run('HG_AUTO_TIMER !== null') === true, 'the single interval starts when armed');
assert(autoCount.style.display !== 'none', 'countdown chip shows while armed');
assert(run("document.getElementById('autoRef120000').classList.contains('on')") === true
    && run("document.getElementById('autoRefOff').classList.contains('on')") === false,
  'active segment repaints to 2m');
const timer1 = run('HG_AUTO_TIMER');
run("setAutoRefresh('180000')");
assert(run('HG_AUTO_MS') === 120000 && storeMem.get('hgAutoRefresh') === '120000',
  '3m request ignored — stays hard-coded at 120000ms');
assert(run('HG_AUTO_TIMER') !== null && run('HG_AUTO_TIMER') !== timer1,
  'changing the choice re-arms the interval (old one cleared, never stacked)');
run("setAutoRefresh('300000')");
assert(run('HG_AUTO_MS') === 120000 && storeMem.get('hgAutoRefresh') === '120000',
  '5m request ignored — stays hard-coded at 120000ms');
run("setAutoRefresh('bogus')");
assert(run('HG_AUTO_MS') === 120000 && storeMem.get('hgAutoRefresh') === '120000',
  'unknown choice still hard-locked to 2m (no throw, no OFF)');
assert(run('HG_AUTO_TIMER !== null') === true && autoCount.style.display !== 'none',
  'interval stays armed and countdown visible when hard-coded');

/* ---------------- 8. restore on load ---------------- */
storeMem.set('hgAutoRefresh', '900000');
run('hgAutoInit()');
assert(run('HG_AUTO_MS') === 120000 && run('HG_AUTO_TIMER !== null') === true,
  'saved 15m choice overridden to hard-coded 2m on load');
assert(run("document.getElementById('autoRef120000').classList.contains('on')") === true,
  'restored segment painted as 2m active');
storeMem.set('hgAutoRefresh', 'garbage');
run('hgAutoInit()');
assert(run('HG_AUTO_MS') === 120000 && run('HG_AUTO_TIMER !== null') === true,
  'corrupt saved value still forces hard-coded 2m');
storeMem.delete('hgAutoRefresh');

/* ---------------- 9. scheduled fire → the EXISTING hardRefreshAll ---------------- */
sandbox.__stubs.hardRefreshAll = async function(){ bump('hardRefreshAll'); };
run('hardRefreshAll = window.__stubs.hardRefreshAll;');   /* rebind like the inline stubs above */
run("setAutoRefresh('120000')");
const hraBefore = sandbox.__calls.hardRefreshAll || 0;
run('HG_AUTO_NEXT = Date.now() - 1');                     /* pretend the tick is due */
run('hgAutoTick()');
assert((sandbox.__calls.hardRefreshAll || 0) === hraBefore + 1,
  'a due tick fires hardRefreshAll exactly once — no second refresh pipeline');
assert(run('HG_AUTO_NEXT > Date.now()') === true,
  'the next tick is re-booked even though this one fired (busy self-skip keeps the cadence)');
run('hgAutoTick()');
assert((sandbox.__calls.hardRefreshAll || 0) === hraBefore + 1,
  'a non-due tick only updates the countdown — no extra fire');
assert(/^next \d+:\d{2}$/.test(autoCount.textContent),
  'countdown chip shows mm:ss while armed — got: "' + autoCount.textContent + '"');

/* OFF request ignored when hard-coded */
run("setAutoRefresh('off')");
assert(run('HG_AUTO_MS') === 120000 && run('HG_AUTO_TIMER !== null') === true,
  'OFF request ignored — interval stays armed at hard-coded 2m');
run('HG_AUTO_NEXT = Date.now() - 1');
run('hgAutoTick()');
assert((sandbox.__calls.hardRefreshAll || 0) === hraBefore + 2,
  'scheduled fires continue after OFF attempt (hard-coded 2m)');
assert(autoCount.style.display !== 'none', 'countdown stays visible after OFF attempt');

/* ---------------- settle & summary ---------------- */
process.on('unhandledRejection', () => {});
await new Promise(r => setTimeout(r, 200));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
console.log('ALL HARD-REFRESH TESTS PASSED');
process.exit(0);
