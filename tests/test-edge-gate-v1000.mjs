/* HARDGATE — hg-v1000: COMPLETE THE GATE. v999 put the proven-edge gate on
   the scanner cards; v1000 closes the ways evidence and buttons leaked AROUND
   it. This file pins every one of them, and every part fails on the pre-v1000
   tree:

     PART A (bare vm) — the verdict's pool/mechanic OVERRIDE (a BEST card is
       judged on BEST:swing / SWING-CLEAN, not on a CARD:best pool that does
       not exist) and the STATE-FLIP ALERTER (first sighting seeds silently,
       a flip INTO proven/losing pushes Telegram-first then ntfy, one push per
       key per hour, flips into unproven never push, and the gate's OFF mode
       does not mute the information).

     PART B (full DOM-stub harness, same shape as test-proven-edge.mjs) —
       B1: cardHTML records the RAW symbol. Venue-decorated display strings
           ('[Delta India] TESTUSD') could never match the raw-sym resolves the
           scan loops hand back — that evidence looked recorded and was frozen.
       B2: the swing scan SETTLES what the ledger is owed. Before v1000 no
           scan called hgFwdResolve for the inline pools, so the CARD and BEST
           pools' evidence could never converge and the gate had nothing to judge.
           A record on an unscanned symbol must stay open (the open-set read
           keeps resolves surgical).
       B3: smartCardHTML JOINS the ledger (confirmed setups record CARD:smart /
           SMART-SWING keyed by the Binance-twin sym, never the CoinDCX display
           name) and its buttons answer to the same gate at the smart desk's
           own evidence floor.
       B4: static pins — BOTH BEST render paths (dual-venue and legacy) run
           the gate; no ungated button site survives.

   Run: node tests/test-edge-gate-v1000.mjs */

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

function bootA(){
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

/* Same settled-pool seeder as test-proven-edge.mjs: nWins reach T1 (+1.5R),
   nLosses stop out (-1R), distinct barT per record, horizon wide enough. */
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

console.log('== A1. the verdict judges the OVERRIDDEN pool/mechanic ==');
{
  const W = bootA();
  W.HG_DESK_TAB_PARAMS = { global: {}, tabs: { swing: { minEvidence: 7 } } };
  seedPool(W, 'BEST:swing', 'SWING-CLEAN', 7, 0);
  const v = W.hgProvenEdgeVerdict('swing', 'best', { pool: 'BEST:swing', mechanic: 'SWING-CLEAN' });
  assert(v.state === 'proven' && v.floor === 7,
    'BEST:swing / SWING-CLEAN at the swing floor of 7 -> proven (got ' + v.state + ', floor ' + v.floor + ')');
  assert(v.pool === 'BEST:swing' && v.mechanic === 'SWING-CLEAN',
    'and the verdict echoes the pool/mechanic it judged (got ' + v.pool + ' / ' + v.mechanic + ')');
  const vd = W.hgProvenEdgeVerdict('swing', 'best');
  assert(vd.state === 'unproven' && vd.pool === 'CARD:swing',
    'without the override the default CARD:swing pool is read instead — the override does not leak (got ' + vd.state + ' on ' + vd.pool + ')');
}

console.log('== A2. the state-flip alerter: seed silent, flip pushes once, throttle, mode-off still tells ==');
{
  const W = bootA();
  const tg = [], nt = [];
  W.sendTelegram = (t, b) => { tg.push([t, b]); };
  W.sendAlertPush = (t, b, o) => { nt.push([t, b, o]); };
  const KEY = 'CARD:div|DIV';
  const V = state => ({ state: state, n: 5, expR: state === 'losing' ? -0.4 : 1.2, pool: 'CARD:div', mechanic: 'DIV' });

  const seedT = W.hgProvenEdgeTrack('div', 'div', V('proven'));
  assert(seedT === null && tg.length === 0 && nt.length === 0,
    'first sighting SEEDS SILENTLY — a state never seen before is a baseline, not a change');

  const flip1 = W.hgProvenEdgeTrack('div', 'div', V('losing'));
  assert(!!flip1 && flip1.from === 'proven' && flip1.to === 'losing', 'the flip is reported as a transition');
  assert(tg.length === 1 && nt.length === 1 && tg[0][0].indexOf('EDGE LOSING') !== -1 && nt[0][2] && nt[0][2].priority === 4,
    'a flip INTO losing pushes once — Telegram first, ntfy second at priority 4 ("' + (tg[0] ? tg[0][0] : '') + '")');

  const flip2 = W.hgProvenEdgeTrack('div', 'div', V('proven'));
  assert(!!flip2 && flip2.to === 'proven' && tg.length === 1 && nt.length === 1,
    'a second flip inside the hour is REPORTED but not PUSHED — one push per key per hour');

  /* rewind the throttle stamp two hours and the next flip speaks again */
  const st = JSON.parse(W.localStorage.getItem('hg_proven_edge_states_v1') || '{}');
  st[KEY].alertAt = Date.now() - 2 * 3600 * 1000;
  W.localStorage.setItem('hg_proven_edge_states_v1', JSON.stringify(st));
  W.hgProvenEdgeTrack('div', 'div', V('losing'));
  assert(tg.length === 2 && nt.length === 2, 'after the throttle window the flip pushes again');

  const flip3 = W.hgProvenEdgeTrack('div', 'div', V('unproven'));
  assert(!!flip3 && flip3.to === 'unproven' && tg.length === 2,
    'a flip INTO unproven never pushes — "we do not know yet" is not an alarm');

  /* re-parse FRESH — the unproven track above rewrote the state, and writing
     the stale snapshot back would undo the flip this step is about */
  const st2 = JSON.parse(W.localStorage.getItem('hg_proven_edge_states_v1') || '{}');
  st2[KEY].alertAt = Date.now() - 2 * 3600 * 1000;
  W.localStorage.setItem('hg_proven_edge_states_v1', JSON.stringify(st2));
  W.localStorage.setItem('hg_proven_edge_v1', '0');
  W.hgProvenEdgeTrack('div', 'div', V('proven'));
  assert(tg.length === 3 && nt.length === 3,
    'the gate\'s OFF mode does not mute the alert — the record is still true, and information was never the thing being gated');
  W.localStorage.removeItem('hg_proven_edge_v1');
}

/* ==================== PART B — the real renderers, gated ================= */
/* Harness identical in shape to test-proven-edge.mjs part B. */

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
  blocks.forEach((body, i) => vm.runInContext(body, ctx, { filename: 'index.html:inline-' + (i + 1) }));
}catch(e){ loadErr = e; }
assert(!loadErr, 'B: inline blocks execute with the v1000 gate loaded'
  + (loadErr ? ' — got: ' + (loadErr && loadErr.stack ? loadErr.stack.split('\n').slice(0, 3).join(' | ') : '') : ''));

const run = code => vm.runInContext(code, ctx);

run('(function(){ try{ if (S.alertTimer) clearInterval(S.alertTimer); }catch(e0){} S.alertTimer=null; S.alertBusy=false; S.alertsOn=false; __hgTabScanSeq=(__hgTabScanSeq||0)+1000; if (typeof hgScanAllTabs==="function") hgScanAllTabs=async function(){ return { refreshed:0, skipped:0, failed:0, failedNames:[] }; }; })()');

/* The divergence fixture that encodes a regular-bullish signal (same knots as
   test-div-scan-leg.mjs), and a 260-bar swing fixture that rallies through a
   102.5 T1 inside 20 bars of a record fired 4h before it starts. */
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

/* hg-forward's settle path Array.isArray-CHECKS its rows (hgFwdResolve ->
   hg-forward.js), and a vm realm's Array.isArray FAILS on arrays born in this
   file — a cross-realm fixture makes the resolve silently no-op. So the
   fixtures the scan legs hand to the ledger are BORN IN THE VM; the main-realm
   divRows above survives only to be JSON-round-tripped into smartCardHTML's
   rows4h (JSON.parse inside the vm re-births it there). */
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
  /* 260 bars at 4H SPACING — hgFwdBarsFitRec refuses to settle a 4h record on
     15m bars, honestly — that sit at 100 for ten, then rally ~0.3/bar: a long
     fired 4h before bar 0 with T1 102.5 / stop 90 touches target around bar
     18, inside a 20-bar horizon */
  window.__swingRows = linRows(260, [[0,100],[10,100],[30,106],[259,107]], 14400);
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

  /* ---- B1. cardHTML records the RAW symbol, not the venue display string ---- */
  clearLedger();
  run('window.__DATA__ = { "TESTUSD|4h": window.__divRows };');
  run('S.tickers = [];');
  const divCardsEl = documentStub.getElementById('divCards');
  divCardsEl.innerHTML = '';
  let threw = null;
  try{ await run('runDivScanLeg({ venueTag: "Delta India" })'); }catch(e){ threw = e; }
  assert(!threw, 'B1: runDivScanLeg with a venue tag completes' + (threw ? ' — got: ' + threw.message : ''));
  assert(divCardsEl.innerHTML.indexOf('class="card ') !== -1, 'B1: the card still prints, venue-decorated for the reader');
  const divRecs = ledger().filter(r => r.tab === 'CARD:divergence');
  assert(divRecs.length >= 1, 'B1: the card was recorded (ledger holds ' + divRecs.length + ' CARD:divergence records)');
  assert(divRecs.length > 0 && divRecs.every(r => r.sym === 'TESTUSD' && r.sym.indexOf('[') === -1),
    'B1: the record carries the RAW sym the scan loops resolve with — "[Delta India] TESTUSD" could never settle (got: '
    + divRecs.map(r => '"' + r.sym + '"').join(', ') + ')');

  /* ---- B2. the swing scan SETTLES what the ledger is owed ---- */
  clearLedger();
  run(`(function(){
    hgFwdRecord({ tab:'CARD:swing', mechanic:'SWING', sym:'TESTUSD', tf:'4h', dir:'long',
      entry:100, stop:90, t1:102.5, barT: ${T0} - 4*3600, horizonBars: 20 });
    hgFwdRecord({ tab:'CARD:swing', mechanic:'SWING', sym:'NEVERSCANNEDUSD', tf:'4h', dir:'long',
      entry:100, stop:90, t1:102.5, barT: ${T0} - 4*3600, horizonBars: 20 });
  })()`);
  const preOpen = ledger().filter(r => r.sym === 'TESTUSD' && r.state === 'open').length;
  assert(preOpen === 1, 'B2: the owed record starts OPEN, waiting for bars no scan used to hand back');
  run('window.__DATA__ = { "TESTUSD|4h": window.__swingRows };');
  run('S.tickers = [];');
  threw = null;
  try{ await run('runScanLeg("swing", {})'); }catch(e){ threw = e; }
  assert(!threw, 'B2: runScanLeg("swing") completes' + (threw ? ' — got: ' + threw.message : ''));
  const postRecs = ledger();
  const owed = postRecs.filter(r => r.sym === 'TESTUSD');
  const control = postRecs.filter(r => r.sym === 'NEVERSCANNEDUSD');
  assert(owed.length === 1 && owed[0].state !== 'open',
    'B2: THE KEYSTONE — the scan settled the owed record on the bars it already fetched (state now "' + (owed[0] && owed[0].state) + '"; pre-v1000 it stayed open forever)');
  assert(owed.length === 1 && owed[0].state === 't1',
    'B2: and it settled honestly — the fixture touched the 102.5 T1 inside the horizon (r=' + (owed[0] && owed[0].r) + ')');
  assert(control.length === 1 && control[0].state === 'open',
    'B2: a symbol no scan fetched stays OPEN — the open-set read keeps resolves surgical, never a guessed outcome');

  /* ---- B3. smartCardHTML: the SMART desk records, and its buttons answer to the gate ---- */
  const smartFloor = run('hgProvenEdgeFloor("smart")');
  assert(smartFloor === 2, 'B3: the smart desk is judged at its committed minEvidence of 2 (got ' + smartFloor + ')');
  const smartR = {
    sym: 'TESTUSD', venueSym: 'TESTUSD-PERP-CDCX', venue: 'cdcx', markPrice: 100,
    cls: { dir: 'long', longEv: ['OI UP', 'CVD UP'], shortEv: ['FUNDING HOT'], regime: [] },
    setup: { type: 'SWING', dir: 'long', entry: 100, stop: 95, t1: 116.25, t2: 120, rr1: 3.25, rr2: 4, riskPct: 1, confirmed: true },
    rows4h: divRows, rows1h: [],
    tick: { chg24: 1, turnoverUsd: 1e7 },
    fundingPct: 0.01, oiChgPct: 2, oiSource: 'binance', binanceOiChgPct: 2, oiUsd: 5e6, binanceOISharePct: 50,
    retailLongPct: 45, topLongPct: 52, takerRatio: 1.1,
    cross: null, bookImb: null
  };
  const driveSmart = () => run('smartCardHTML(' + JSON.stringify(smartR) + ')');

  clearLedger();
  const smOut1 = driveSmart();
  assert(smOut1.indexOf('EDGE UNPROVEN') !== -1, 'B3: a fresh ledger reads UNPROVEN on the SMART card');
  assert(smOut1.indexOf('SEND TO TRADE PLAN') === -1 && smOut1.indexOf('WATCH ONLY') !== -1,
    'B3: unproven is WATCH ONLY — before v1000 these buttons printed with NO record anywhere');
  const smRecs = ledger().filter(r => r.tab === 'CARD:smart');
  assert(smRecs.length === 1 && smRecs[0].mechanic === 'SMART-SWING' && smRecs[0].tf === '4h' && smRecs[0].horizonBars === 20,
    'B3: the confirmed setup RECORDED — pool CARD:smart, mechanic SMART-SWING, the 4h horizon (got ' + JSON.stringify(smRecs[0] && { mech: smRecs[0].mechanic, tf: smRecs[0].tf, hz: smRecs[0].horizonBars }) + ')');
  assert(smRecs.length === 1 && smRecs[0].sym === 'TESTUSD',
    'B3: keyed by the Binance-twin sym the scan resolves with, never the CoinDCX display name "' + smartR.venueSym + '"');

  const seedSmart = (nWins, nLosses) => {
    clearLedger();
    run(`(function(){
      var BAR = Math.floor(Date.now()/1000/${HR}) * ${HR};
      var i = 0;
      function mk(){ hgFwdRecord({ tab:'CARD:smart', mechanic:'SMART-SWING', sym:'SEEDSMARTUSD', tf:'1h', dir:'long',
        entry:100, stop:90, t1:115, barT: BAR - (++i+1)*${HR}, horizonBars: 48 }); }
      for (var k=0;k<${nWins};k++) mk();
      for (var k2=0;k2<${nLosses};k2++) mk();
      var rows=[];
      for (var j=1;j<=4;j++) rows.push({ t: BAR-${HR}+j*${HR}, o:100,
        h: (${nWins ? 'true' : 'false'} && j===2) ? 116 : 101,
        l: (${nLosses ? 'true' : 'false'} && !${nWins ? 'true' : 'false'} && j===2) ? 88 : 99, c:100, v:1 });
      hgFwdResolve('SEEDSMARTUSD','1h',rows);
    })()`);
  };
  seedSmart(0, 2);
  const smOut2 = driveSmart();
  assert(smOut2.indexOf('EDGE LOSING') !== -1 && smOut2.indexOf('SEND TO TRADE PLAN') === -1 && smOut2.indexOf('WATCH ONLY') !== -1,
    'B3: a settled LOSING record at the floor withdraws the buttons');
  seedSmart(2, 0);
  const smOut3 = driveSmart();
  assert(smOut3.indexOf('EDGE PROVEN') !== -1 && smOut3.indexOf('SEND TO TRADE PLAN') !== -1 && smOut3.indexOf('WATCH ONLY') === -1,
    'B3: a settled PROVEN record at the floor earns the buttons back');

  /* ---- B4. static pins: BOTH BEST render paths run the gate ---- */
  const src = readFileSync(path.join(root, 'index.html'), 'utf8');
  const nVerdict = (src.match(/hgProvenEdgeVerdict\('swing','best',\{pool:'BEST:swing',mechanic:'SWING-CLEAN'\}\)/g) || []).length;
  const nSlot = (src.match(/\$\{bestBtnsHtml\}/g) || []).length;
  const nChip = (src.match(/\$\{bestPEChip\}/g) || []).length;
  /* hg-v1001 re-pointed this pin: the gate expression gained the agreement
     condition (desk-agree.js) — (bestPEBlocks || bestAgreeBlocks) ? (bestPENote
     + bestAgreeNote). hg-v1003 extended it once more with the fundamental
     gate (fundamental-stack.js): (bestPEBlocks || bestAgreeBlocks ||
     bestFundBlocks) ? (bestPENote + bestAgreeNote + bestFundNote). The intent
     is unchanged: both button blocks collapse into the gated note when ANY
     gate says so. */
  const nGated = (src.match(/\(bestPEBlocks \|\| bestAgreeBlocks( \|\| bestFundBlocks)?\) \? \(bestPENote \+ bestAgreeNote( \+ bestFundNote)?\)/g) || []).length;
  assert(nVerdict === 2, 'B4: both BEST render paths (dual-venue + legacy) judge BEST:swing / SWING-CLEAN (found ' + nVerdict + ')');
  assert(nSlot === 2 && nChip === 2, 'B4: both templates carry the chip and the single gated button slot (slots ' + nSlot + ', chips ' + nChip + ')');
  assert(nGated === 2, 'B4: no ungated BEST button site survives — both button blocks collapse into the WATCH ONLY note when the record says so (found ' + nGated + ')');

  /* ---------------- settle & summary ---------------- */
  process.on('unhandledRejection', () => {});
  await new Promise(r => setTimeout(r, 300));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  for (const h of __intervals){ try{ clearInterval(h); }catch(e){} }
  for (const h of __timers){ try{ clearTimeout(h); }catch(e){} }
  await new Promise(r => setTimeout(r, 50));
  if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
  console.log('ALL EDGE-GATE v1000 TESTS PASSED');
  process.exit(0);
})();
