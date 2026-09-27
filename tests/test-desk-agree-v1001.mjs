/* HARDGATE — hg-v1001: THE ACCURACY LEVERS. Two changes, one file, every
   part proven failing on the pre-v1001 tree:

     PART A (bare vm) — desk-agree.js, the multi-desk agreement board:
       A1  base-asset unification ('[Delta India] BTCUSD' == 'BTCUSDT' ==
           'B-BTC_USDT' == 'BTCUSD-PERP') — without it cross-venue
           agreement could never fire.
       A2  family aliases — 'best' merges into 'swing' (the same cascade;
           correlated confirmation is not confirmation).
       A3  cross-venue agreement, self-exclusion, direction discipline.
       A4  the merge is a MERGE: best + swing on one coin is ONE opinion.
       A5  the 45-minute TTL — a stale print is not a current confirmation.
       A6  STACKED ONLY is opt-in (default OFF blocks nothing), the toggle
           flips it, and ON blocks exactly when no OTHER family confirms.
       A7  THE ZERO-FILL GAP (proven-edge.js): a pool of resting-limit
           entries the tape never reaches settles raw WINS nobody could
           have taken (OMNIROUTE replay: 34.3% of plans never fill). When
           the decidable fill record clears the desk floor with ZERO fills
           the verdict is unproven-with-the-reason, never proven — and
           never 'losing' either, an order that never opened lost nothing.

     PART B (full DOM-stub harness, same shape as test-edge-gate-v1000.mjs) —
       B1  the REAL div render leg, gated: with the pool PROVEN (the
           proven-edge gate passes) and STACKED ONLY on, an empty board
           withdraws the buttons; a second family's print brings them back
           with the STACK ×2 chip; mode OFF restores evidence-only gating.
       B2  static pins — script tag, drawer chip, sw.js shell entry, and
           the smart/BEST wiring all present.

   Run: node tests/test-desk-agree-v1001.mjs */

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

/* ==================== PART A — bare vm units ==================== */

/* desk-agree.js alone, with the TTL clock under the test's hand. The module
   only ever calls Date.now(), so a plain { now } object is the whole stub. */
function bootAgree(){
  const store = {};
  const ctx = { console, Math, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String };
  let NOW = 1700000000000;
  ctx.Date = { now: () => NOW };
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(path.join(root, 'desk-agree.js'), 'utf8'), ctx, { filename: 'desk-agree.js' });
  return { W: ctx, advance: ms => { NOW += ms; } };
}

console.log('== A1. base-asset unification ==');
{
  const { W } = bootAgree();
  const b = W.hgDeskAgreeBaseSym;
  assert(b('[Delta India] BTCUSD') === 'BTC', 'A1: venue tag stripped — "[Delta India] BTCUSD" -> BTC (got ' + b('[Delta India] BTCUSD') + ')');
  assert(b('BTCUSDT') === 'BTC' && b('BTCUSD') === 'BTC' && b('BTCINR') === 'BTC',
    'A1: quote suffixes unify — BTCUSDT/BTCUSD/BTCINR are one coin');
  assert(b('B-BTC_USDT') === 'BTC', 'A1: CoinDCX B- boundary kept BEFORE the alnum strip — B-BTC_USDT -> BTC, not BBTC (got ' + b('B-BTC_USDT') + ')');
  assert(b('BTCUSD-PERP') === 'BTC', 'A1: the PERP suffix goes too — BTCUSD-PERP -> BTC (got ' + b('BTCUSD-PERP') + ')');
}

console.log('== A2. family aliases ==');
{
  const { W } = bootAgree();
  const f = W.hgDeskAgreeFamily;
  assert(f('best') === 'swing', 'A2: BEST merges into SWING — the same cascade, not a second opinion');
  assert(f('divergence') === 'div' && f('liq-trap') === 'trap' && f('coil-expansion') === 'coil',
    'A2: the desk aliases follow the desks\' own convention (divergence->div, liq-trap->trap, coil-expansion->coil)');
  assert(f('smc') === 'smc' && f('ob') === 'ob', 'A2: unaliased desks keep their own family');
}

console.log('== A3. agreement across venues; a desk never confirms itself; direction never crosses ==');
{
  const { W } = bootAgree();
  W.hgDeskAgreeNote('smc', '[Delta India] BTCUSD', 'long');
  const q1 = W.hgDeskAgree('BTCUSDT', 'long', 'div');
  assert(q1.total === 1 && q1.others === 1 && q1.desks.join(',') === 'smc',
    'A3: smc\'s print on "[Delta India] BTCUSD" answers a BTCUSDT query from div (got total=' + q1.total + ' others=' + q1.others + ' desks=' + q1.desks + ')');
  const q2 = W.hgDeskAgree('BTCUSDT', 'long', 'smc');
  assert(q2.total === 1 && q2.others === 0, 'A3: a desk never confirms itself — smc asking about its own print reads others=0');
  const q3 = W.hgDeskAgree('BTCUSDT', 'short', 'div');
  assert(q3.total === 0 && q3.others === 0, 'A3: direction never crosses — a long print says nothing about a short');
  const bad = W.hgDeskAgreeNote('smc', 'BTCUSD', 'sideways');
  assert(bad === false, 'A3: a non-direction is refused at the door');
}

console.log('== A4. BEST + SWING is ONE opinion ==');
{
  const { W } = bootAgree();
  W.hgDeskAgreeNote('best', 'ETHUSD', 'short');
  W.hgDeskAgreeNote('swing', 'ETHUSDT', 'short');
  const q = W.hgDeskAgree('ETHUSD', 'short', 'smc');
  assert(q.total === 1 && q.others === 1,
    'A4: best and swing land on ONE family key — total 1, not 2 (got total=' + q.total + ')');
  const qSelf = W.hgDeskAgree('ETHUSD', 'short', 'swing');
  assert(qSelf.others === 0, 'A4: the swing cascade asking about its own print reads others=0');
}

console.log('== A5. the 45-minute TTL ==');
{
  const { W, advance } = bootAgree();
  W.hgDeskAgreeNote('smc', 'BTCUSD', 'long');
  advance(44 * 60 * 1000);
  assert(W.hgDeskAgree('BTCUSD', 'long', 'div').others === 1, 'A5: 44 minutes on, the print is still a current confirmation');
  advance(2 * 60 * 1000);
  const q = W.hgDeskAgree('BTCUSD', 'long', 'div');
  assert(q.others === 0 && q.total === 0, 'A5: at 46 minutes the print is stale and DROPPED — an old opinion is not "now"');
}

console.log('== A6. STACKED ONLY is opt-in; the toggle; blocks() exact ==');
{
  const { W } = bootAgree();
  assert(W.hgDeskAgreeMode() === false, 'A6: default OFF — the anti-deadlock rule (coverage depends on which desks scanned)');
  assert(W.hgDeskAgreeBlocks({ total: 0, others: 0, desks: [] }) === false,
    'A6: OFF blocks NOTHING, even with an empty board — the chip still prints, because the agreement is still true');
  const on = W.hgDeskAgreeToggle();
  assert(on === true && W.hgDeskAgreeMode() === true && W.localStorage.getItem('hg_desk_agree_only_v1') === '1',
    'A6: the toggle turns the mode ON and persists it');
  assert(W.hgDeskAgreeBlocks({ total: 1, others: 0, desks: ['div'] }) === true,
    'A6: ON + no OTHER family confirming -> blocked');
  assert(W.hgDeskAgreeBlocks({ total: 2, others: 1, desks: ['div', 'smc'] }) === false,
    'A6: ON + a second family -> passes');
  assert(W.hgDeskAgreeBlocks(null) === false, 'A6: a null agreement read blocks nothing — the safe shape');
  W.hgDeskAgreeToggle();
  assert(W.hgDeskAgreeMode() === false, 'A6: the toggle back restores evidence-only gating');
  const chip = W.hgDeskAgreeChipHtml({ total: 2, others: 1, desks: ['div', 'smc'] });
  assert(chip.indexOf('STACK ×2 DESKS') !== -1, 'A6: the chip prints whenever a second desk agrees (got "' + chip + '")');
  assert(W.hgDeskAgreeChipHtml({ total: 1, others: 0, desks: ['div'] }) === '', 'A6: no second desk -> no chip');
  assert(W.hgDeskAgreeBlockedNoteHtml({}).indexOf('STACKED ONLY') !== -1, 'A6: the blocked note names the gate');
}

console.log('== A7. THE ZERO-FILL GAP ==');

function bootVerdict(){
  const store = {};
  const ctx = { console, Math, Date, isFinite, parseFloat, parseInt, JSON, Array, Object, Number, String };
  ctx.localStorage = { getItem: k => (k in store ? store[k] : null),
                       setItem: (k, v) => { store[k] = String(v); },
                       removeItem: k => { delete store[k]; } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(path.join(root, 'hg-forward.js'), 'utf8'), ctx, { filename: 'hg-forward.js' });
  vm.runInContext(readFileSync(path.join(root, 'backtest-tab-params.js'), 'utf8'), ctx, { filename: 'backtest-tab-params.js' });
  vm.runInContext(readFileSync(path.join(root, 'proven-edge.js'), 'utf8'), ctx, { filename: 'proven-edge.js' });
  return ctx;
}

/* Three resting-limit longs: entry 100, stop 90, T1 106 (+0.6R), mark 102
   (price ABOVE the entry at record time -> BUY_LIMIT — the tape must come
   back to 100 or nobody is aboard). resolve() gets `dip` — whether bar 1
   reaches the entry — and the tape always runs through 106. */
function seedLimitPool(W, pool, mech, dip){
  const sym = 'ZF-' + pool.replace(/[^A-Za-z0-9]/g, '') + (dip ? 'DIP' : 'NODIP');
  for (let i = 0; i < 3; i++){
    W.hgFwdRecord({ tab: pool, mechanic: mech, sym: sym, tf: '1h', dir: 'long',
      entry: 100, stop: 90, t1: 106, mark: 102, barT: BAR - (i + 2) * HR, horizonBars: 4 });
  }
  const rows = [];
  for (let k = 0; k < 4; k++){
    rows.push({ t: BAR + k * HR, o: 101,
      h: (k === 2) ? 107 : 103,              /* bar 2 runs the raw tally's target */
      l: (dip && k === 0) ? 99.5 : 100.5,    /* only the dip variant ever reaches the 100 limit */
      c: 101, v: 1 });
  }
  W.hgFwdResolve(sym, '1h', rows);
  return sym;
}
/* The marketable variant: mark == entry -> BUY, filled at record time. */
function seedMarketPool(W, pool, mech){
  const sym = 'ZF-' + pool.replace(/[^A-Za-z0-9]/g, '') + 'MKT';
  for (let i = 0; i < 3; i++){
    W.hgFwdRecord({ tab: pool, mechanic: mech, sym: sym, tf: '1h', dir: 'long',
      entry: 100, stop: 90, t1: 106, mark: 100, barT: BAR - (i + 2) * HR, horizonBars: 4 });
  }
  const rows = [];
  for (let k = 0; k < 4; k++){
    rows.push({ t: BAR + k * HR, o: 101, h: (k === 2) ? 107 : 103, l: 100.5, c: 101, v: 1 });
  }
  W.hgFwdResolve(sym, '1h', rows);
}

{
  const W = bootVerdict();
  W.HG_DESK_TAB_PARAMS = { global: {}, tabs: { div: { minEvidence: 3 } } };
  seedLimitPool(W, 'CARD:div', 'DIV', false);
  const stats = W.hgFwdStats('CARD:div', 'DIV', false);
  assert(stats && stats.samples === 3 && stats.wins === 3,
    'A7: the raw tally reads 3/3 WINS — the tape ran the target (got samples=' + (stats && stats.samples) + ' wins=' + (stats && stats.wins) + ')');
  assert(stats && stats.fillSamples === 0 && stats.fillUnfilled === 3,
    'A7: ...on orders that NEVER FILLED — the entries were never reached (fillSamples=' + (stats && stats.fillSamples) + ' unfilled=' + (stats && stats.fillUnfilled) + ')');
  const v = W.hgProvenEdgeVerdict('div', 'div');
  assert(v.state === 'unproven' && /0\/3 orders ever filled/.test(v.note || ''),
    'A7: THE GAP, CLOSED — never-fill pools read UNPROVEN with the reason named, not proven on paper wins (got ' + v.state + ' / "' + v.note + '")');
  assert(v.state !== 'losing',
    'A7: and never LOSING — an order that never opened lost nothing; this gate does not claim losses that did not happen');
  assert(W.hgProvenEdgeBlocks(v) === true, 'A7: the zero-fill verdict blocks the buttons exactly like any other unproven read');
}
{
  const W = bootVerdict();
  W.HG_DESK_TAB_PARAMS = { global: {}, tabs: { div: { minEvidence: 3 } } };
  seedLimitPool(W, 'CARD:div', 'DIV', true);
  const v = W.hgProvenEdgeVerdict('div', 'div');
  assert(v.state === 'proven' && v.fillAware === true,
    'A7: regression — the SAME entries fill when the tape reaches them, and the fill-aware verdict is proven (got ' + v.state + ', fillAware=' + v.fillAware + ')');
}
{
  const W = bootVerdict();
  W.HG_DESK_TAB_PARAMS = { global: {}, tabs: { div: { minEvidence: 3 } } };
  seedMarketPool(W, 'CARD:div', 'DIV');
  const v = W.hgProvenEdgeVerdict('div', 'div');
  assert(v.state === 'proven' && v.fillAware === true,
    'A7: regression — marketable entries (mark == entry) fill by construction and stay proven (got ' + v.state + ', fillAware=' + v.fillAware + ')');
}

/* ==================== PART B — the real renderers, gated ================= */
/* Harness identical in shape to test-edge-gate-v1000.mjs part B. */

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
  load('hg-plan.js');
  load('backtest-tab-params.js');
  load('structure-core.js');
  load('hg-forward.js');
  load('proven-edge.js');
  load('desk-agree.js');
  blocks.forEach((body, i) => vm.runInContext(body, ctx, { filename: 'index.html:inline-' + (i + 1) }));
}catch(e){ loadErr = e; }
assert(!loadErr, 'B: inline blocks execute with the v1001 levers loaded'
  + (loadErr ? ' — got: ' + (loadErr && loadErr.stack ? loadErr.stack.split('\n').slice(0, 3).join(' | ') : '') : ''));

const run = code => vm.runInContext(code, ctx);

run('(function(){ try{ if (S.alertTimer) clearInterval(S.alertTimer); }catch(e0){} S.alertTimer=null; S.alertBusy=false; S.alertsOn=false; __hgTabScanSeq=(__hgTabScanSeq||0)+1000; if (typeof hgScanAllTabs==="function") hgScanAllTabs=async function(){ return { refreshed:0, skipped:0, failed:0, failedNames:[] }; }; })()');

/* The divergence fixture that encodes a regular-bullish signal (same knots as
   test-edge-gate-v1000.mjs), BORN IN THE VM — hg-forward's settle path
   Array.isArray-checks its rows, and a cross-realm array fails that check. */
const T0 = 1700000000;
const VM_FIXTURES = `(function(){
  var T0 = ${T0};
  function bar(i, o, h, l, c, v, step){ return { t: T0 + i*(step || 900), o: o, h: h, l: l, c: c, v: (v == null ? 100 : v) }; }
  function linRows(n, knots, step){
    var out = [], ki = 0;
    for (var i = 0; i < n; i++){
      while (ki < knots.length - 2 && i > knots[ki + 1][0]) ki++;
      var a = knots[ki], b = knots[ki + 1];
      var f = (i - a[0]) / Math.max(1, b[0] - a[0]);
      var c = a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, f));
      out.push(bar(i, c - 0.05, c + 0.3, c - 0.3, c, 100 + (i % 7), step));
    }
    return out;
  }
  window.__divRows = linRows(176, [[0,110],[104,110],[120,100],[135,106],[158,102],[159,100.2],[160,99],[161,101.2],[175,104.5]]);
  window.__divRows[174] = bar(174, 103.8, 104.2, 103.5, 104.0, 200);
  window.__divRows[175] = bar(175, 104.0, 104.8, 103.9, 104.5, 220);
  window.__TICK = { symbol: 'TESTUSD', mark: 0, chg24: 1, turnoverUsd: 1e7, fundingPct: 0.01 };
})()`;

(async function main(){

  await run('hgBacktestParamsLoad(true)');

  run(VM_FIXTURES);
  run('getTickers = async function(){ return [window.__TICK]; };');
  run('getCandles = async function(sym, tf, n){ const d = window.__DATA__[sym + "|" + tf]; if (!d) throw new Error("no fixture " + sym + "|" + tf); return d.slice(-n); };');
  run('getXAUCandles = async function(){ return []; };');
  run('tickClock = function(){ return 120; };');

  /* the ledger, decoded in THIS realm (vm return values are cross-realm objects) */
  const ledger = () => JSON.parse(run('localStorage.getItem("hg_forward_v1") || "[]"'));
  const clearLedger = () => run('localStorage.removeItem("hg_forward_v1")');

  /* ---- B1. the real div leg, gated by STACKED ONLY ----------------------
     Sequence: (1) run once unseeded to learn the mechanic the card records
     under; (2) seed that pool PROVEN — the proven-edge gate now PASSES, so
     only the agreement gate can be holding the buttons; (3) STACKED ONLY
     on + an empty board -> WATCH ONLY; (4) mode OFF -> buttons return;
     (5) a second family's print + mode ON -> buttons AND the STACK chip. */
  run('window.__DATA__ = { "TESTUSD|4h": window.__divRows };');
  const divCardsEl = documentStub.getElementById('divCards');
  const runLeg = async () => {
    divCardsEl.innerHTML = '';
    run('S.tickers = [];');
    await run('runDivScanLeg({})');
    return divCardsEl.innerHTML;
  };

  clearLedger();
  const out0 = await runLeg();
  assert(out0.indexOf('class="card ') !== -1, 'B1: the div card prints');
  const divRecs = ledger().filter(r => r.tab === 'CARD:divergence');
  assert(divRecs.length >= 1, 'B1: the tradeable card recorded (ledger holds ' + divRecs.length + ' CARD:divergence records)');
  const mech = divRecs.length ? String(divRecs[0].mechanic) : 'DIVERGENCE';
  const dir = (divRecs.length && divRecs[0].dir) ? String(divRecs[0].dir) : 'long';
  assert(run('hgProvenEdgeFloor("divergence")') === 3, 'B1: the div desk is judged at its committed minEvidence of 3');

  /* seed the div pool PROVEN — three markless winners (markless => no fill
     read => fillKnown 0 < floor, the judge reads the raw tally and the
     zero-fill gap cannot trip) */
  run(`(function(){
    var BAR = Math.floor(Date.now()/1000/${HR}) * ${HR};
    var i = 0;
    function mk(){ hgFwdRecord({ tab:'CARD:divergence', mechanic:${JSON.stringify(mech)}, sym:'SEEDDIVUSD', tf:'1h', dir:'long',
      entry:100, stop:90, t1:115, barT: BAR - (++i+1)*${HR}, horizonBars: 48 }); }
    for (var k=0;k<3;k++) mk();
    var rows=[];
    for (var j=1;j<=4;j++) rows.push({ t: BAR-${HR}+j*${HR}, o:100, h: (j===2)?116:101, l:99, c:100, v:1 });
    hgFwdResolve('SEEDDIVUSD','1h',rows);
  })()`);

  run('localStorage.setItem("hg_desk_agree_only_v1","1")');
  const out1 = await runLeg();
  assert(out1.indexOf('EDGE PROVEN') !== -1,
    'B1: the pool is PROVEN — the proven-edge gate passes, so only the agreement gate can be holding the buttons');
  assert(out1.indexOf('SEND TO TRADE PLAN') === -1 && out1.indexOf('STACKED ONLY') !== -1,
    'B1: STACKED ONLY on + an empty board withdraws the buttons and names the gate');
  assert(out1.indexOf('STACK ×') === -1,
    'B1: no STACK chip — the card\'s own print never confirms itself (the board holds only div\'s note)');

  run('localStorage.setItem("hg_desk_agree_only_v1","0")');
  const out2 = await runLeg();
  assert(out2.indexOf('SEND TO TRADE PLAN') !== -1,
    'B1: mode OFF restores evidence-only gating — the buttons return on the proven record alone');

  run('hgDeskAgreeNote("smc", "TESTUSD", ' + JSON.stringify(dir) + ')');
  run('localStorage.setItem("hg_desk_agree_only_v1","1")');
  const out3 = await runLeg();
  assert(out3.indexOf('SEND TO TRADE PLAN') !== -1,
    'B1: a second INDEPENDENT family confirming the same coin+direction brings the buttons back');
  assert(out3.indexOf('STACK ×2 DESKS') !== -1,
    'B1: ...and the STACK ×2 DESKS chip prints (got chip present: ' + (out3.indexOf('STACK ×2 DESKS') !== -1) + ')');

  /* ---- B2. static pins ------------------------------------------------ */
  const src = readFileSync(path.join(root, 'index.html'), 'utf8');
  assert(src.indexOf('src="desk-agree.js?v=') !== -1, 'B2: index.html loads desk-agree.js');
  assert(src.indexOf('id="chipDeskAgree"') !== -1 && src.indexOf('hgDeskAgreeToggle()') !== -1,
    'B2: the header drawer carries the STACKED ONLY toggle');
  assert(src.indexOf('hgDeskAgreeNote(scanId, sym, dir)') !== -1
      && src.indexOf('${deskAgreeChip}') !== -1
      && src.indexOf('${deskAgreeBlockedHtml}') !== -1
      && src.indexOf('tradeable && !provenBlocks && !agreeBlocks') !== -1,
    'B2: cardHTML notes its print, carries the chip + blocked note, and gates both buttons on agreement');
  assert(src.indexOf("hgDeskAgreeNote('smart', String(r.sym || ''), s.dir)") !== -1
      && (src.match(/!smartPEBlocks && !smartAgreeBlocks/g) || []).length === 2,
    'B2: smartCardHTML notes confirmed setups and gates both its buttons (found '
      + (src.match(/!smartPEBlocks && !smartAgreeBlocks/g) || []).length + '/2 button gates)');
  assert((src.match(/hgDeskAgreeNote\('swing', w\.t\.symbol, w\.dir\)/g) || []).length === 2
      && (src.match(/\$\{bestPEChip\}\$\{bestAgreeChip\}/g) || []).length === 2
      && (src.match(/\(bestPEBlocks \|\| bestAgreeBlocks\)/g) || []).length === 2,
    'B2: BOTH BEST render paths note as swing, carry the chip beside the proven-edge chip, and gate — no ungated BEST button site survives');
  const swSrc = readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert(swSrc.indexOf("'./desk-agree.js'") !== -1, 'B2: sw.js precaches desk-agree.js in the app shell');

  /* ---------------- settle & summary ---------------- */
  process.on('unhandledRejection', () => {});
  await new Promise(r => setTimeout(r, 300));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  for (const h of __intervals){ try{ clearInterval(h); }catch(e){} }
  for (const h of __timers){ try{ clearTimeout(h); }catch(e){} }
  await new Promise(r => setTimeout(r, 50));
  if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
  console.log('ALL DESK-AGREE v1001 TESTS PASSED');
  process.exit(0);
})();
