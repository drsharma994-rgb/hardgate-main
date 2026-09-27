/* HARDGATE — the PROVEN-EDGE gate (hg-v999): a card's action buttons are
   earned by a measured, settled, out-of-sample record.

   The owner asked for "100 percent profitable setups only". That setup does
   not exist; the honest analogue shipped instead: SEND TO TRADE PLAN and
   ADD TO BOOK appear on a card only when THAT strategy's OWN forward record
   on THAT tab (pool 'CARD:<scanner>', mechanic '<STRATEGY>') has cleared the
   desk's minEvidence floor with positive expectancy, judged by the ledger's
   own hgFwdJudgeSample. Below the floor or at/under zero expectancy the card
   still prints — with an evidence chip and a WATCH ONLY note — and IS STILL
   RECORDED, because a gate that stopped recording what it demoted could
   never change its mind.

   Part A drives the verdict itself in a bare vm (hg-forward.js +
   backtest-tab-params.js + proven-edge.js over a stub localStorage):
   proven / losing / unproven, the desk-param floor override, the tab aliases
   ('liq-trap' reads the 'trap' row its own R:R floor reads), the default-ON
   mode and the opt-out.

   Part B drives the real DIV leg through the full DOM-stub harness (same
   shape as test-div-scan-leg.mjs) with seeded ledgers and requires: a LOSING
   record leaves the card printed, chip marked, buttons gone, AND THE LEDGER
   STILL GROWING (the anti-deadlock invariant); mode OFF returns the buttons
   while the chip stays (the record is still true); a PROVEN record keeps
   chip and buttons; an empty ledger reads UNPROVEN, not a pass.

   Run: node tests/test-proven-edge.mjs */

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

const HR = 3600;
const BAR = Math.floor(Date.now() / 1000 / HR) * HR;

/* ==================== PART A — the verdict, in a bare vm ==================== */

function bootA(withForward){
  const store = {};
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String };
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  if (withForward !== false)
    vm.runInContext(readFileSync(path.join(root, 'hg-forward.js'), 'utf8'), ctx, { filename: 'hg-forward.js' });
  vm.runInContext(readFileSync(path.join(root, 'backtest-tab-params.js'), 'utf8'), ctx, { filename: 'backtest-tab-params.js' });
  vm.runInContext(readFileSync(path.join(root, 'proven-edge.js'), 'utf8'), ctx, { filename: 'proven-edge.js' });
  return ctx;
}

/* Settle a pool: nWins records reach T1 (+1.5R each), nLosses stop out (-1R).
   Distinct barT per record (the ledger keys on it), horizon wide enough that
   the oldest record is still inside its walk when the bars arrive. */
function seedPool(W, pool, mech, nWins, nLosses){
  const sym = 'SEED-' + pool.replace(/[^A-Za-z0-9]/g, '');
  let i = 0;
  const mk = () => W.hgFwdRecord({ tab: pool, mechanic: mech, sym: sym, tf: '1h', dir: 'long',
    entry: 100, stop: 90, t1: 115, barT: BAR - (++i + 1) * HR, horizonBars: 48 });
  for (let k = 0; k < nWins; k++) mk();
  for (let k = 0; k < nLosses; k++) mk();
  const rows = [];
  for (let k = 1; k <= 4; k++)
    rows.push({ t: BAR - HR + k * HR, o: 100,
      h: (nWins && k === 2) ? 116 : 101,
      l: (!nWins && k === 2) ? 88 : 99, c: 100, v: 1 });
  W.hgFwdResolve(sym, '1h', rows);
}

console.log('== A1. a settled WINNING record at the floor is PROVEN ==');
{
  const W = bootA();
  seedPool(W, 'CARD:div', 'DIV', 20, 0);
  const v = W.hgProvenEdgeVerdict('div', 'div');
  assert(v.state === 'proven', '20 settled winners, floor 20 (no params pack) -> proven (got ' + v.state + ')');
  assert(v.n === 20 && v.floor === 20, 'judged at n=20 against the fallback floor 20 (n=' + v.n + ', floor=' + v.floor + ')');
  assert(v.expR > 0 && Math.abs(v.expR - 1.5) < 1e-9, 'expectancy is the tally\'s own +1.50R (got ' + v.expR + ')');
  assert(!W.hgProvenEdgeBlocks(v), 'a proven verdict does not block');
}

console.log('== A2. a settled LOSING record at the floor is LOSING ==');
{
  const W = bootA();
  seedPool(W, 'CARD:div', 'DIV', 0, 20);
  const v = W.hgProvenEdgeVerdict('div', 'div');
  assert(v.state === 'losing', '20 settled losers -> losing (got ' + v.state + ')');
  assert(v.expR === -1, 'a record that never won states exactly -1R, not a dash (got ' + v.expR + ')');
  assert(W.hgProvenEdgeBlocks(v), 'a losing verdict blocks the buttons');
}

console.log('== A3. below the floor is UNPROVEN, and unproven is not a pass ==');
{
  const W = bootA();
  seedPool(W, 'CARD:div', 'DIV', 3, 0);
  const v = W.hgProvenEdgeVerdict('div', 'div');
  assert(v.state === 'unproven', '3 settled against a floor of 20 -> unproven (got ' + v.state + ')');
  assert(v.n === 3 && v.floor === 20 && v.note === '3/20 settled',
    'and it reports progress honestly: "' + v.note + '"');
  assert(W.hgProvenEdgeBlocks(v), 'unproven blocks too — the ask was proven only');
}

console.log('== A4. the floor is the desk\'s own minEvidence row ==');
{
  const W = bootA();
  /* hgDeskParam reads the injected pack directly (no fetch in a unit vm);
     div carries minEvidence 3 in the committed data/desk-tab-params.json. */
  W.HG_DESK_TAB_PARAMS = { global: {}, tabs: { div: { minEvidence: 3 }, trap: { minEvidence: 5 } } };
  seedPool(W, 'CARD:div', 'DIV', 3, 0);
  const v = W.hgProvenEdgeVerdict('div', 'div');
  assert(v.state === 'proven' && v.floor === 3,
    'div\'s measured floor of 3 governs, not the 20 fallback (state ' + v.state + ', floor ' + v.floor + ')');
  const v2 = W.hgProvenEdgeVerdict('divergence', 'divergence');
  assert(v2.floor === 3, 'the scanner id "divergence" reaches the same div row via normTab (floor ' + v2.floor + ')');
}

console.log('== A5. tab aliases: a desk\'s evidence floor comes from the row its R:R floor reads ==');
{
  const W = bootA();
  W.HG_DESK_TAB_PARAMS = { global: {}, tabs: { trap: { minEvidence: 5 } } };
  seedPool(W, 'CARD:liq-trap', 'LIQ-TRAP', 4, 0);
  const v4 = W.hgProvenEdgeVerdict('liq-trap', 'liq-trap');
  assert(v4.state === 'unproven' && v4.floor === 5,
    'liq-trap is judged at the trap row\'s floor of 5 — 4 settled is not enough (state ' + v4.state + ', floor ' + v4.floor + ')');
  /* one more settled winner on the same pool crosses the floor */
  W.hgFwdRecord({ tab: 'CARD:liq-trap', mechanic: 'LIQ-TRAP', sym: 'SEED-CARDliqtrap', tf: '1h', dir: 'long',
    entry: 100, stop: 90, t1: 115, barT: BAR - 60 * HR, horizonBars: 96 });
  const rows = [];
  for (let k = 1; k <= 4; k++) rows.push({ t: BAR - HR + k * HR, o: 100, h: k === 2 ? 116 : 101, l: 99, c: 100, v: 1 });
  W.hgFwdResolve('SEED-CARDliqtrap', '1h', rows);
  const v5 = W.hgProvenEdgeVerdict('liq-trap', 'liq-trap');
  assert(v5.state === 'proven' && v5.n === 5, 'and at 5 settled winners the buttons are earned (state ' + v5.state + ', n=' + v5.n + ')');
}

console.log('== A6. the mode: default ON, explicit opt-out, and OFF blocks nothing ==');
{
  const W = bootA();
  assert(W.hgProvenEdgeMode() === true, 'mode defaults ON — that was the ask');
  seedPool(W, 'CARD:div', 'DIV', 0, 20);
  const losing = W.hgProvenEdgeVerdict('div', 'div');
  assert(W.hgProvenEdgeBlocks(losing) === true, 'ON: a losing record blocks');
  W.localStorage.setItem('hg_proven_edge_v1', '0');
  assert(W.hgProvenEdgeMode() === false, 'the opt-out reads honestly');
  assert(W.hgProvenEdgeBlocks(losing) === false, 'OFF: the same losing record blocks nothing');
  assert(W.hgProvenEdgeBlocks(null) === false, 'OFF: even a missing verdict blocks nothing');
  W.localStorage.removeItem('hg_proven_edge_v1');
  assert(W.hgProvenEdgeBlocks(null) === true, 'ON: a missing verdict blocks — unproven is not a pass');
  const t = W.hgProvenEdgeToggle();
  assert(t === false && W.localStorage.getItem('hg_proven_edge_v1') === '0', 'the toggle writes the opt-out and returns the new state');
  assert(W.hgProvenEdgeToggle() === true && W.localStorage.getItem('hg_proven_edge_v1') === '1', 'and back on');
}

console.log('== A7. the chip says the state in the established gpip pattern ==');
{
  const W = bootA();
  W.HG_DESK_TAB_PARAMS = { global: {}, tabs: { div: { minEvidence: 3 } } };
  seedPool(W, 'CARD:div', 'DIV', 3, 0);
  const pv = W.hgProvenEdgeVerdict('div', 'div');
  const phtml = W.hgProvenEdgeChipHtml(pv);
  assert(phtml.indexOf('gpip ok') !== -1 && phtml.indexOf('EDGE PROVEN') !== -1 && phtml.indexOf('n=3') !== -1,
    'proven chip: ok class, state, sample (' + phtml.slice(0, 90) + '…)');
  W.localStorage.removeItem('hg_forward_v1');
  seedPool(W, 'CARD:div', 'DIV', 0, 3);
  const lhtml = W.hgProvenEdgeChipHtml(W.hgProvenEdgeVerdict('div', 'div'));
  assert(lhtml.indexOf('gpip bad') !== -1 && lhtml.indexOf('EDGE LOSING') !== -1 && lhtml.indexOf('-1.00R') !== -1,
    'losing chip: bad class and the stated -1.00R (' + lhtml.slice(0, 90) + '…)');
  W.localStorage.removeItem('hg_forward_v1');
  seedPool(W, 'CARD:div', 'DIV', 1, 0);
  const uhtml = W.hgProvenEdgeChipHtml(W.hgProvenEdgeVerdict('div', 'div'));
  assert(uhtml.indexOf('EDGE UNPROVEN') !== -1 && uhtml.indexOf('1/3 settled') !== -1 && uhtml.indexOf('gpip ok') === -1 && uhtml.indexOf('gpip bad') === -1,
    'unproven chip: neutral class, progress against the floor (' + uhtml.slice(0, 90) + '…)');
  const bhtml = W.hgProvenEdgeBlockedNoteHtml(W.hgProvenEdgeVerdict('div', 'div'));
  assert(bhtml.indexOf('WATCH ONLY') !== -1 && bhtml.indexOf('still recorded') !== -1,
    'the blocked note says WATCH ONLY and states the anti-deadlock invariant on the card');
}

console.log('== A8. degradation: no forward log -> unproven, never a crash ==');
{
  const W = bootA(false);
  const v = W.hgProvenEdgeVerdict('div', 'div');
  assert(v.state === 'unproven' && /not loaded/.test(v.note), 'without hg-forward.js the verdict is unproven ("' + v.note + '")');
  assert(W.hgProvenEdgeBlocks(v) === true, 'and ON, that blocks safely');
  W.localStorage.setItem('hg_proven_edge_v1', '0');
  assert(W.hgProvenEdgeBlocks(v) === false, 'and OFF, it still blocks nothing');
}

/* ==================== PART B — the real DIV leg, gated ==================== */
/* Harness identical in shape to test-div-scan-leg.mjs: stub DOM, tracked
   timers, the desk's real params pack through the desk's own loader. */

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
  activeElement: null, title: '', hidden: false, visibilityState: 'visible',
  readyState: 'complete'
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

const deskParams = JSON.parse(readFileSync(path.join(root, 'data/desk-tab-params.json'), 'utf8'));
const fetchStub = async (url) => {
  if (String(url).indexOf('desk-tab-params.json') !== -1){
    return { ok: true, status: 200, statusText: 'ok',
      json: async () => JSON.parse(JSON.stringify(deskParams)),
      text: async () => JSON.stringify(deskParams) };
  }
  return { ok: false, status: 503, statusText: 'stubbed',
    json: async () => ({}), text: async () => '' };
};

const __timers = [], __intervals = [];
const trackedSetTimeout = (fn, ms, ...args) => { const h = setTimeout(fn, ms, ...args); __timers.push(h); return h; };
const trackedSetInterval = (fn, ms, ...args) => { const h = setInterval(fn, ms, ...args); __intervals.push(h); return h; };
const sandbox = {
  console,
  setTimeout: trackedSetTimeout, clearTimeout,
  setInterval: trackedSetInterval, clearInterval,
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

function load(name){
  vm.runInContext(readFileSync(path.join(root, name), 'utf8'), ctx, { filename: name });
}
let loadErr = null;
try{
  ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'store.js', 'binance.js', 'macro.js',
   'cryptogates.js', 'plans.js', 'setup-stack.js', 'setup-ui.js'].forEach(load);
}catch(e){ loadErr = e; }
assert(!loadErr, 'B: support scripts load without throwing' + (loadErr ? ' — got: ' + loadErr.message : ''));

const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
const blocks = [];
let m;
while ((m = re.exec(html)) !== null){ if (m[1].trim()) blocks.push(m[1]); }
assert(blocks.length === 5, 'B: index.html yields exactly 5 non-empty inline <script> blocks (got ' + blocks.length + ')');

loadErr = null;
try{
  /* Page order: hg-plan.js, backtest-tab-params.js, structure-core.js and
     then — the two this pack is about — hg-forward.js and proven-edge.js,
     both before the inline app blocks that call them. */
  load('hg-plan.js');
  load('backtest-tab-params.js');
  load('structure-core.js');
  load('hg-forward.js');
  load('proven-edge.js');
  blocks.forEach((body, i) => vm.runInContext(body, ctx, { filename: 'index.html:inline-' + (i + 1) }));
}catch(e){ loadErr = e; }
assert(!loadErr, 'B: inline blocks execute with the gate loaded'
  + (loadErr ? ' — got: ' + (loadErr && loadErr.stack ? loadErr.stack.split('\n').slice(0, 3).join(' | ') : '') : ''));

const run = code => vm.runInContext(code, ctx);

run('(function(){ try{ if (S.alertTimer) clearInterval(S.alertTimer); }catch(e0){} S.alertTimer=null; S.alertBusy=false; S.alertsOn=false; __hgTabScanSeq=(__hgTabScanSeq||0)+1000; if (typeof hgScanAllTabs==="function") hgScanAllTabs=async function(){ return { refreshed:0, skipped:0, failed:0, failedNames:[] }; }; })()');

/* The same deterministic regular-bullish fixture test-div-scan-leg.mjs
   proved encodes the signal on both detector paths. */
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
const divRows = linRows(176, [[0, 110], [104, 110], [120, 100], [135, 106], [158, 102], [159, 100.2], [160, 99], [161, 101.2], [175, 104.5]]);
divRows[174] = bar(174, 103.8, 104.2, 103.5, 104.0, 200);
divRows[175] = bar(175, 104.0, 104.8, 103.9, 104.5, 220);
const TICK = { symbol: 'TESTUSD', mark: 0, chg24: 1, turnoverUsd: 1e7, fundingPct: 0.01 };

(async function main(){

  await run('hgBacktestParamsLoad(true)');
  const floor = run('hgProvenEdgeFloor("divergence")');
  assert(floor === 3,
    'B: the divergence leg is judged at the desk\'s committed minEvidence of 3 (got ' + floor + ')');

  run('getTickers = async function(){ return window.__TICKERS__; };');
  run('getCandles = async function(sym, tf, n){ const d = window.__DATA__[sym + "|" + tf]; if (!d) throw new Error("no fixture " + sym + "|" + tf); return d.slice(-n); };');
  run('getXAUCandles = async function(){ return []; };');
  run('tickClock = function(){ return 120; };');

  /* Seed the pool the card records into — 'CARD:divergence' / 'DIVERGENCE' —
     with an already-settled record, through the ledger's own public API. */
  function seed(nWins, nLosses){
    run('localStorage.removeItem("hg_forward_v1")');
    run(`(function(){
      var BAR = Math.floor(Date.now()/1000/${HR}) * ${HR};
      var i = 0;
      function mk(){ hgFwdRecord({ tab:'CARD:divergence', mechanic:'DIVERGENCE', sym:'SEEDUSD', tf:'1h', dir:'long',
        entry:100, stop:90, t1:115, barT: BAR - (++i+1)*${HR}, horizonBars: 48 }); }
      for (var k=0;k<${nWins};k++) mk();
      for (var k2=0;k2<${nLosses};k2++) mk();
      var rows=[];
      for (var j=1;j<=4;j++) rows.push({ t: BAR-${HR}+j*${HR}, o:100,
        h: (${nWins ? 'true' : 'false'} && j===2) ? 116 : 101,
        l: (${nLosses ? 'true' : 'false'} && !${nWins ? 'true' : 'false'} && j===2) ? 88 : 99, c:100, v:1 });
      hgFwdResolve('SEEDUSD','1h',rows);
    })()`);
  }
  const ledgerLen = () => run('(function(){ try{ var l = JSON.parse(localStorage.getItem("hg_forward_v1") || "[]"); return l.length; }catch(e){ return -1; } })()');

  async function driveLeg(){
    sandbox.__TICKERS__ = [TICK];
    sandbox.__DATA__ = { 'TESTUSD|4h': divRows };
    run('S.tickers = [];');
    const cardsEl = documentStub.getElementById('divCards');
    cardsEl.innerHTML = '';
    let threw = null;
    try{ await run('runDivScanLeg({})'); }catch(e){ threw = e; }
    assert(!threw, 'B: runDivScanLeg completes' + (threw ? ' — got: ' + threw.message : ''));
    const out = cardsEl.innerHTML;
    assert((out.match(/class="card /g) || []).length >= 1, 'B: the leg still PRINTS the card — the gate never hides the setup');
    return out;
  }

  /* ---- B1. a LOSING record: card printed, chip marked, buttons gone,
         and the ledger STILL GROWS — the anti-deadlock invariant ---- */
  seed(0, 3);
  const beforeLose = ledgerLen();
  const loseOut = await driveLeg();
  assert(loseOut.indexOf('EDGE LOSING') !== -1, 'B1: the card names the losing record on its chip');
  assert(loseOut.indexOf('SEND TO TRADE PLAN') === -1, 'B1: no SEND TO TRADE PLAN button on a losing record');
  assert(loseOut.indexOf('WATCH ONLY') !== -1, 'B1: the WATCH ONLY note stands where the button would');
  assert(ledgerLen() > beforeLose,
    'B1: THE INVARIANT — a demoted card is still recorded (' + beforeLose + ' -> ' + ledgerLen() + '), or the gate could never change its mind');

  /* ---- B2. mode OFF: the buttons return, the chip stays ---- */
  run('localStorage.setItem("hg_proven_edge_v1", "0")');
  const offOut = await driveLeg();
  assert(offOut.indexOf('SEND TO TRADE PLAN') !== -1, 'B2: opted out, the button returns');
  assert(offOut.indexOf('EDGE LOSING') !== -1, 'B2: the chip stays — OFF never hides the record, it only stops gating');
  run('localStorage.removeItem("hg_proven_edge_v1")');

  /* ---- B3. a PROVEN record: chip and buttons both ---- */
  seed(3, 0);
  const provenOut = await driveLeg();
  assert(provenOut.indexOf('EDGE PROVEN') !== -1, 'B3: the chip says PROVEN once the settled record earns it');
  assert(provenOut.indexOf('SEND TO TRADE PLAN') !== -1, 'B3: and the buttons stand on a proven record');

  /* ---- B4. an empty ledger is UNPROVEN, not a pass ---- */
  run('localStorage.removeItem("hg_forward_v1")');
  const freshOut = await driveLeg();
  assert(freshOut.indexOf('EDGE UNPROVEN') !== -1, 'B4: a fresh ledger reads UNPROVEN on the card');
  assert(freshOut.indexOf('SEND TO TRADE PLAN') === -1 && freshOut.indexOf('WATCH ONLY') !== -1,
    'B4: and unproven is WATCH ONLY — "we do not know yet" is not a pass');

  /* ---- B5. without proven-edge.js nothing changes: the pre-gate renderer
         is byte-identical in behaviour (feature check, not absence crash) ---- */
  sandbox.__savedPE = run('({ v: window.hgProvenEdgeVerdict, b: window.hgProvenEdgeBlocks, c: window.hgProvenEdgeChipHtml, n: window.hgProvenEdgeBlockedNoteHtml })');
  run('delete window.hgProvenEdgeVerdict; delete window.hgProvenEdgeBlocks; delete window.hgProvenEdgeChipHtml; delete window.hgProvenEdgeBlockedNoteHtml;');
  const noPEOut = await driveLeg();
  assert(noPEOut.indexOf('SEND TO TRADE PLAN') !== -1 && noPEOut.indexOf('EDGE ') === -1,
    'B5: with the module absent the card renders exactly as before the pack — buttons, no chip');
  run('window.hgProvenEdgeVerdict = window.__savedPE.v; window.hgProvenEdgeBlocks = window.__savedPE.b; window.hgProvenEdgeChipHtml = window.__savedPE.c; window.hgProvenEdgeBlockedNoteHtml = window.__savedPE.n;');

  /* ---------------- settle & summary ---------------- */
  process.on('unhandledRejection', () => {});
  await new Promise(r => setTimeout(r, 300));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  for (const h of __intervals){ try{ clearInterval(h); }catch(e){} }
  for (const h of __timers){ try{ clearTimeout(h); }catch(e){} }
  await new Promise(r => setTimeout(r, 50));
  if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
  console.log('ALL PROVEN-EDGE TESTS PASSED');
  process.exit(0);
})();
