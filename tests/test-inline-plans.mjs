/* HARDGATE — universal SL/TP on the 7 inline crypto tabs (AGENT INDEX scope).
   Two layers, same vm harness as test-tabs.mjs (stub DOM + dead fetch):
     A. pure decision/markup functions from index.html —
        hgPlanLevels (universal fallback plan: entry = last close or the card's
        own trigger, stop = lastSwing(30) or 1.5×ATR against dir, T1 = 2R,
        T2 = 3.5R) and planBlock (oiflow/smartCardHTML-style plan line with
        honest 'levels unavailable — size down' degrade);
     B. render paths — the 7 inline scans (scalp, coil, apex, trap, smc, ob,
        div) each driven against deterministic candle fixtures that pass that
        tab's gates; every emitted card must carry 'STOP' and 'T1' in its plan
        block. scalp additionally asserts the 24h time-stop note and the
        hgc-scalp mini-chart container.
   Fixtures are deterministic (no wall-clock dependence; tickClock is stubbed
   for scalp's funding-settlement gate). Run: node tests/test-inline-plans.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
  alert(){}, confirm(){ return true; }, prompt(){ return ''; }
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);

/* ---------------- load support scripts + inline blocks ---------------- */
function load(name){
  vm.runInContext(readFileSync(path.join(root, name), 'utf8'), ctx, { filename: name });
}
let loadErr = null;
try{
  ['indicators.js', 'indicators2.js', 'store.js', 'binance.js', 'macro.js'].forEach(load);
}catch(e){ loadErr = e; }
assert(!loadErr, 'support scripts load without throwing' + (loadErr ? ' — got: ' + loadErr.message : ''));

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
assert(!loadErr, 'all 3 inline blocks execute without throwing'
  + (loadErr ? ' — got: ' + (loadErr && loadErr.stack ? loadErr.stack.split('\n').slice(0, 3).join(' | ') : loadErr) : ''));

const run = code => vm.runInContext(code, ctx);

/* ================= A. pure plan functions ================= */
assert(run('typeof hgPlanLevels') === 'function' && run('typeof window.hgPlanLevels') === 'function',
  'hgPlanLevels defined and exported on window');
assert(run('typeof hgPlanBlock') === 'function' && run('typeof window.hgPlanBlock') === 'function',
  'hgPlanBlock defined and exported on window');

/* uptrend rows: clean 30-bar swing low below entry */
const upRows = [];
for (let i = 0; i < 120; i++){
  const c = 100 + i*0.2;
  upRows.push({ t: 1700000000 + i*14400, o: c - 0.05, h: c + 0.3, l: c - 0.3, c: c, v: 100 });
}
sandbox.__up = upRows;
{
  const pl = run('hgPlanLevels("long", window.__up)');
  const entry = upRows[upRows.length - 1].c;
  assert(pl && pl.dir === 'long' && Math.abs(pl.entry - entry) < 1e-9,
    'hgPlanLevels long: entry = last close');
  assert(pl && pl.stop < pl.entry && pl.t1 > pl.entry && pl.t2 > pl.t1,
    'hgPlanLevels long: stop below entry, T1/T2 above');
  const risk = pl.entry - pl.stop;
  assert(Math.abs(pl.t1 - (pl.entry + 2*risk)) < 1e-9 && Math.abs(pl.t2 - (pl.entry + 3.5*risk)) < 1e-9,
    'hgPlanLevels long: T1 = 2R, T2 = 3.5R');
}
{
  const pl = run('hgPlanLevels("short", window.__up)');
  assert(pl && pl.stop > pl.entry && pl.t1 < pl.entry && pl.t2 < pl.t1,
    'hgPlanLevels short: stop above entry, T1/T2 below (plan matches direction)');
}
{
  const pl = run('hgPlanLevels("long", window.__up, 120.5)');
  assert(pl && pl.entry === 120.5, 'hgPlanLevels: card trigger level overrides entry');
}
{
  /* no clean swing: flat rows where the 30-bar swing low == entry → ATR stop */
  const flat = [];
  for (let i = 0; i < 120; i++) flat.push({ t: 1700000000 + i*14400, o: 100, h: 100.4, l: 99.6, c: 100, v: 100 });
  flat[119].c = 99.6; flat[119].l = 99.6;   // last close sits exactly at the swing low
  sandbox.__flat = flat;
  const pl = run('hgPlanLevels("long", window.__flat)');
  const a = run('atr(window.__flat, 14)[window.__flat.length-1]');
  assert(pl && Math.abs(pl.stop - (pl.entry - 1.5*a)) < 1e-9 && pl.note.indexOf('ATR') !== -1,
    'hgPlanLevels: missing/wrong-side swing falls back to 1.5×ATR stop with note');
}
{
  /* structure too far: deep swing → capped at 1.5×ATR */
  const pl = run('hgPlanLevels("long", window.__up, 140)');   // trigger far above the 30-bar swing
  const a = run('atr(window.__up, 14)[window.__up.length-1]');
  assert(pl && Math.abs(pl.stop - (140 - 1.5*a)) < 1e-9 && pl.note.indexOf('capped') !== -1,
    'hgPlanLevels: structure beyond 2.5×ATR is capped at 1.5×ATR');
}
{
  assert(run('hgPlanLevels("long", [])') === null
      && run('hgPlanLevels("sideways", window.__up)') === null
      && run('hgPlanLevels("long", null)') === null,
    'hgPlanLevels returns null for empty rows / bad direction (never throws)');
  assert(run('hgPlanBlock("long", [])') === 'levels unavailable — size down',
    'hgPlanBlock degrades to the honest note when levels cannot be computed');
}
{
  const line = run('planBlock("long", 100, 98, 104, 107, "time-stop: exit within 24h")');
  assert(line.indexOf('ENTRY <b>') !== -1 && line.indexOf('STOP <b>') !== -1
      && line.indexOf('T1 <b>') !== -1 && line.indexOf('T2 <b>') !== -1
      && line.indexOf('(2R)') !== -1 && line.indexOf('(3.5R)') !== -1,
    'planBlock emits the oiflow-convention plan line (ENTRY · STOP · T1 2R · T2 3.5R)');
  assert(line.indexOf('time-stop: exit within 24h') !== -1, 'planBlock trails the optional note');
  assert(run('planBlock("long", 100, 100, 104, 107)') === 'levels unavailable — size down',
    'planBlock degrades honestly on zero-risk geometry');
}

/* ================= B. render paths: 7 inline scans ================= */
/* data stubs: fixtures keyed symbol|tf; tickClock pinned away from funding */
run('getTickers = async function(){ return window.__TICKERS__; };');
run('getCandles = async function(sym, tf, n){ const d = window.__DATA__[sym + "|" + tf]; if (!d) throw new Error("no fixture " + sym + "|" + tf); return d.slice(-n); };');
run('getXAUCandles = async function(){ return []; };');
run('tickClock = function(){ return 120; };');

const T0 = 1700000000;
function bar(i, o, h, l, c, v){ return { t: T0 + i*900, o: o, h: h, l: l, c: c, v: (v == null ? 100 : v) }; }
function linRows(n, knots, opt){
  opt = opt || {};
  const rng = opt.range == null ? 0.3 : opt.range;
  const vol = opt.vol || function(i){ return 100 + (i % 7); };
  const out = [];
  let ki = 0;
  for (let i = 0; i < n; i++){
    while (ki < knots.length - 2 && i > knots[ki + 1][0]) ki++;
    const a = knots[ki], b = knots[ki + 1];
    const f = (i - a[0]) / Math.max(1, b[0] - a[0]);
    const c = a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, f));
    out.push(bar(i, c - 0.05, c + rng, c - rng, c, vol(i)));
  }
  return out;
}
const TICK = { symbol: 'TESTUSD', mark: 0, chg24: 1, turnoverUsd: 1e7, fundingPct: 0.01 };
const BTC  = { symbol: 'BTCUSD',  mark: 100, chg24: 0, turnoverUsd: 5e7, fundingPct: 0.01 };

/* scalp: 1H cascade long; 15m sweep of the prior-window low then reclaim close */
const scalpH1 = linRows(120, [[0, 100], [119, 118]]);
const scalpM15 = linRows(160, [[0, 100], [150, 106], [153, 105.6], [155, 105.0], [156, 105.3], [159, 105.75]]);
scalpM15[155].l = 104.6;
scalpM15[159] = bar(159, 105.45, 105.95, 105.35, 105.8, 600);

/* coil: volatile ramp then dead-flat compression, volume drought on last bar */
const coilRows = linRows(200, [[0, 96], [140, 104], [150, 106], [199, 106.05]]);
for (let i = 150; i < 200; i++){ coilRows[i].h = coilRows[i].c + 0.12; coilRows[i].l = coilRows[i].c - 0.12; }
coilRows[199].v = 10;

/* div: strong selloff → bounce → V-spike lower low on weaker RSI → rally */
const divRows = linRows(176, [[0, 110], [104, 110], [120, 100], [135, 106], [158, 102], [159, 100.2], [160, 99], [161, 101.2], [175, 104]]);

/* apex: BTC flat, asset +6% over the last 24 bars */
const apexBtc = linRows(72, [[0, 100], [71, 100.4]]);
const apexAlt = linRows(72, [[0, 100], [46, 100], [71, 106.5]]);

/* trap: oscillation, dip through the outer band at bar 98, reclaim above inner
   (parameters found by exhaustive gate search; R:R to the mean ≈ 1.7) */
const trapRows = (() => {
  const amp = 0.4986512781580218, per = 3.763245738094321, rng = 0.15988745093806062;
  const d = 1.969316151444482, rec = 0.4036869407881456, wick = 0.23677204856033068, sweepAt = 98;
  const rows = [];
  for (let i = 0; i < 100; i++){
    const c = 102 + amp*Math.sin(i*Math.PI/per) + ((i%3)-1)*0.02;
    rows.push(bar(i, c-0.05, c+rng, c-rng, c, 100+(i%7)));
  }
  const c99 = 102 - d + rec;
  for (let k = 96; k <= 99; k++){
    if (k < sweepAt){ const f = (k-95)/(sweepAt-95); rows[k] = bar(k, 102-d*(f-0.1)-0.05, 102-d*(f-0.1)+rng, 102-d*f-rng*0.3, 102-d*f, 130); }
    else if (k === sweepAt){ rows[k] = bar(k, 102-d+0.25, 102-d+0.45, 102-d-wick, 102-d+0.15, 400); }
    else { const g = (k-sweepAt)/(99-sweepAt); rows[k] = bar(k, 102-d+0.1, 102-d+0.15+rec*g+rng*0.3, 102-d+0.05, 102-d+0.15+rec*g, 110); }
  }
  rows[99].c = c99; rows[99].h = c99+rng*0.4; rows[99].l = Math.max(rows[99].l, c99-rng*0.4); rows[99].o = c99-0.1;
  return rows;
})();

/* smc: displacement leaves an unmitigated 4H FVG, price drifts back into it */
const smcRows = linRows(260, [[0, 100], [249, 100], [253, 100.2], [254, 105], [255, 104.2], [256, 103.6], [257, 103.1], [258, 103.0], [259, 102.9]]);
smcRows[252] = bar(252, 100.0, 100.3, 99.9, 100.1);
smcRows[253] = bar(253, 100.1, 105.4, 100.0, 105.0);
smcRows[254] = bar(254, 105.0, 105.2, 104.5, 104.6);
smcRows[255].l = 103.9; smcRows[256].l = 103.3; smcRows[257].l = 102.9; smcRows[258].l = 102.85;
smcRows[259] = bar(259, 103.0, 103.05, 102.8, 102.8);

/* ob: red OB bar, green displacement through the swing high, drift back in */
const obRows = linRows(260, [[0, 99], [249, 99], [253, 99.4], [254, 102.6], [255, 102.2], [259, 100.0]]);
obRows[252] = bar(252, 99.2, 99.3, 98.9, 99.0);
obRows[253] = bar(253, 99.6, 99.7, 99.2, 99.3);
obRows[254] = bar(254, 99.4, 103.0, 99.3, 102.8);
for (let i = 255; i < 260; i++){ obRows[i].l = Math.max(obRows[i].l, 99.5); }
obRows[259].c = 99.55; obRows[259].l = 99.45; obRows[259].h = 99.9;

async function drive(name, runCode, cardsId, tickers, data, extraChecks){
  sandbox.__TICKERS__ = tickers;
  sandbox.__DATA__ = data;
  run('S.tickers = [];');                       // force the stubbed getTickers path
  const cardsEl = documentStub.getElementById(cardsId);
  cardsEl.innerHTML = '';
  let threw = null;
  try{ await run(runCode); }catch(e){ threw = e; }
  assert(!threw, name + ' scan completes without throwing' + (threw ? ' — got: ' + threw.message : ''));
  const out = cardsEl.innerHTML;
  assert(out.length > 0 && out.indexOf('class="card ') !== -1,
    name + ' renders at least one setup card for the fixture');
  assert(out.indexOf('STOP') !== -1 && out.indexOf('T1') !== -1,
    name + ' card plan carries STOP and T1 (universal SL/TP)');
  assert(out.indexOf('levels unavailable — size down') === -1,
    name + ' levels actually computed (no degrade note) for the fixture');
  if (extraChecks) extraChecks(out);
}

(async () => {
  run('try{ localStorage.setItem("hg_dual_scan","0"); }catch(e){}');
  await drive('scalp', 'runScan("scalp")', 'scalpCards', [TICK],
    { 'TESTUSD|1h': scalpH1, 'TESTUSD|15m': scalpM15 },
    (out) => {
      assert(out.indexOf('time-stop: exit within 24h') !== -1,
        'scalp card carries the 24h time-stop note');
      assert(out.indexOf('id="hgc-scalp-TESTUSD"') !== -1,
        'scalp card renders the hgMiniChart container (hgc-scalp-*)');
    });
  await drive('coil', 'runCoilScan()', 'coilCards', [TICK], { 'TESTUSD|4h': coilRows });
  await drive('apex', 'runApexScan()', 'apexCards', [BTC, TICK], { 'BTCUSD|1h': apexBtc, 'TESTUSD|1h': apexAlt });
  await drive('trap', 'runTrapScan()', 'trapCards', [TICK], { 'TESTUSD|15m': trapRows });
  await drive('smc', 'runSmcScan()', 'smcCards', [TICK], { 'TESTUSD|4h': smcRows });
  await drive('ob', 'runObScan()', 'obCards', [TICK], { 'TESTUSD|4h': obRows });
  await drive('div', 'runDivScan()', 'divCards', [TICK], { 'TESTUSD|4h': divRows });

  /* ---------------- settle & summary ---------------- */
  process.on('unhandledRejection', () => {});
  await new Promise(r => setTimeout(r, 300));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
  console.log('ALL INLINE-PLAN TESTS PASSED');
  process.exit(0);
})();
