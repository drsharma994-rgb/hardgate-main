/* HARDGATE — DIVERGENCE tab: the leg must actually PRINT the card its
   fixture earns (hg-v998 regression).

   The bug this guards: runDivScanLeg could never emit a card, in BOTH of
   its paths (the structure-core hgDetectDivergences path AND the legacy
   findPivots fallback), twice over, and every layer of the old suite missed
   it:

     1. T1 was hardcoded at exactly 2R (`entry + 2*risk`) while the card was
        gated on hgTabMinRr('div') — which reads 3.25 from
        data/desk-tab-params.json. 2.0 >= 3.25 is never true, so every
        candidate was `continue`d.
     2. entry/t1/t2 were declared `const` and then REASSIGNED after
        applyExactEntry's refinement — a TypeError that landed in the
        per-symbol `catch(e){}` and was swallowed. Even a candidate that
        somehow cleared the R:R check died here.

   Why the old tests did not catch it: test-inline-plans.mjs's div section
   drove the CARD RENDERER with a hand-built plan (driveRender), never the
   scan leg — every other inline tab drives its real scan. A renderer test
   cannot see a leg that never reaches the renderer.

   What this file does instead: drive runDivScanLeg itself, through the
   same vm harness as test-inline-plans.mjs (stub DOM + tracked timers),
   with the desk's REAL params pack loaded through the desk's own loader
   (hgBacktestParamsLoad reading the committed data/desk-tab-params.json),
   on BOTH detector paths, against the same deterministic regular-bullish
   fixture the old file already proved encodes a signal. The card must come
   out, its plan must clear the floor the desk actually configured (3.25,
   not the 2.5 code fallback), and the gate label must name that floor.

   Fixtures are deterministic (no wall-clock). Run: node tests/test-div-scan-leg.mjs */

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

/* ---------------- stub DOM (same shape as test-inline-plans.mjs) ---------------- */
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

/* The fetch stub serves the ONE file this test is about: the desk's real
   params pack, so hgTabMinRr('div') resolves to the configured 3.25 through
   the desk's own loader rather than the 2.5 code fallback. Everything else
   stays dead — a scan leg must not need the network in a unit test. */
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

/* Tracked timers, same reason as test-inline-plans.mjs: app boot arms
   intervals, and process.exit with live handles races Windows teardown. */
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

/* ---------------- load support scripts + inline blocks ---------------- */
function load(name){
  vm.runInContext(readFileSync(path.join(root, name), 'utf8'), ctx, { filename: name });
}
let loadErr = null;
try{
  ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'store.js', 'binance.js', 'macro.js',
   'cryptogates.js', 'plans.js', 'setup-stack.js', 'setup-ui.js'].forEach(load);
}catch(e){ loadErr = e; }
assert(!loadErr, 'support scripts load without throwing' + (loadErr ? ' — got: ' + loadErr.message : ''));

const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const re = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
const blocks = [];
let m;
while ((m = re.exec(html)) !== null){ if (m[1].trim()) blocks.push(m[1]); }
assert(blocks.length === 5, 'index.html yields exactly 5 non-empty inline <script> blocks (got ' + blocks.length + ')');

loadErr = null;
try{
  /* Same script order as the page: hg-plan.js (applyExactEntry),
     backtest-tab-params.js (hgDeskParam — the floor this bug was about) and
     structure-core.js (hgDetectDivergences — the modern detector path) all
     load before the inline app blocks in index.html. */
  load('hg-plan.js');
  load('backtest-tab-params.js');
  load('structure-core.js');
  blocks.forEach((body, i) => vm.runInContext(body, ctx, { filename: 'index.html:inline-' + (i + 1) }));
}catch(e){ loadErr = e; }
assert(!loadErr, 'inline blocks execute without throwing'
  + (loadErr ? ' — got: ' + (loadErr && loadErr.stack ? loadErr.stack.split('\n').slice(0, 3).join(' | ') : '') : ''));

const run = code => vm.runInContext(code, ctx);

/* Disarm the boot alert cycle so the drive owns the desk (same reason as
   test-inline-plans.mjs). */
run('(function(){ try{ if (S.alertTimer) clearInterval(S.alertTimer); }catch(e0){} S.alertTimer=null; S.alertBusy=false; S.alertsOn=false; __hgTabScanSeq=(__hgTabScanSeq||0)+1000; if (typeof hgScanAllTabs==="function") hgScanAllTabs=async function(){ return { refreshed:0, skipped:0, failed:0, failedNames:[] }; }; })()');

/* ---------------- fixture: regular bullish divergence ---------------- */
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
/* The same regular-bullish fixture test-inline-plans.mjs proved encodes the
   signal: lower low on price (100 -> 99), higher low on RSI, fresh pivot. */
const divRows = linRows(176, [[0, 110], [104, 110], [120, 100], [135, 106], [158, 102], [159, 100.2], [160, 99], [161, 101.2], [175, 104.5]]);
divRows[174] = bar(174, 103.8, 104.2, 103.5, 104.0, 200);
divRows[175] = bar(175, 104.0, 104.8, 103.9, 104.5, 220);
const TICK = { symbol: 'TESTUSD', mark: 0, chg24: 1, turnoverUsd: 1e7, fundingPct: 0.01 };

(async function main(){

  /* ---- 0. the floor this test is judged against is the desk's own ---- */
  await run('hgBacktestParamsLoad(true)');
  const floor = run('hgTabMinRr("div", 2.5)');
  assert(Math.abs(floor - 3.25) < 1e-12,
    'hgTabMinRr("div") resolves to the committed desk value 3.25 (got ' + floor + ') — the number the old 2R hardcode could never clear');

  /* ---- 1. the fixture really does encode the signal (no vacuity) ---- */
  sandbox.__divRows = divRows;
  const legacyProbe = run('(function(){ var rows=window.__divRows; var c=rows.map(function(r){return r.c}); var rv=rsi(c,14); var pivots=findPivots(c,3); var lows=pivots.filter(function(p){return p.type==="low"}); if(lows.length>=2){ var l1=lows[lows.length-2],l2=lows[lows.length-1]; if(l2.i-l1.i>=10&&isFinite(rv[l1.i])&&isFinite(rv[l2.i])&&l2.v<l1.v&&rv[l2.i]>rv[l1.i]) return "long"; } return null; })()');
  assert(legacyProbe === 'long', 'fixture still encodes a regular bullish divergence for the LEGACY pivot path');
  const modernProbe = run('(function(){ if (typeof hgDetectDivergences !== "function") return "no-detector"; var rows=window.__divRows; var n=rows.length; var res=hgDetectDivergences(rows,{rsiPeriod:14}); function pick(list){ for (var di=list.length-1; di>=0; di--){ var d=list[di]; if (!d || d.span<10 || d.span>40) continue; if ((n-1-d.p2.i)>15) continue; return d; } return null; } var d=pick(res.regular)||pick(res.hidden); return d ? d.side : null; })()');
  assert(modernProbe === 'long',
    'fixture still encodes a divergence the MODERN detector path would pick (got ' + modernProbe + ')');

  /* data stubs, same pattern as test-inline-plans.mjs */
  run('getTickers = async function(){ return window.__TICKERS__; };');
  run('getCandles = async function(sym, tf, n){ const d = window.__DATA__[sym + "|" + tf]; if (!d) throw new Error("no fixture " + sym + "|" + tf); return d.slice(-n); };');
  run('getXAUCandles = async function(){ return []; };');
  run('tickClock = function(){ return 120; };');
  /* capture the plan the leg actually ships, so the R:R assertion reads the
     emitted object rather than parsing it back out of card markup */
  run('(function(){ var __origAE = applyExactEntry; applyExactEntry = function(){ var r = __origAE.apply(this, arguments); (window.__divPlans = window.__divPlans || []).push(r); return r; }; })()');

  async function driveLeg(label){
    sandbox.__TICKERS__ = [TICK];
    sandbox.__DATA__ = { 'TESTUSD|4h': divRows };
    run('S.tickers = [];');
    run('window.__divPlans = [];');
    const cardsEl = documentStub.getElementById('divCards');
    cardsEl.innerHTML = '';
    const statEl = documentStub.getElementById('divStat');
    statEl.textContent = '';
    let threw = null;
    try{ await run('runDivScanLeg({})'); }catch(e){ threw = e; }
    assert(!threw, label + ': runDivScanLeg completes without throwing' + (threw ? ' — got: ' + threw.message : ''));
    const out = cardsEl.innerHTML;
    const cardCount = (out.match(/class="card /g) || []).length;
    assert(cardCount >= 1,
      label + ': the leg PRINTS at least one card for a gated divergence (the bug: zero cards, forever)');
    assert(out.indexOf('STOP') !== -1 && out.indexOf('T1') !== -1,
      label + ': card plan carries STOP and T1');
    assert(out.indexOf('levels unavailable — size down') === -1,
      label + ': levels actually computed (no degrade note)');
    const gateLabel = run('"G5 R:R>=" + fmt(hgTabMinRr("div", 2.5), 1)');
    assert(out.indexOf(gateLabel) !== -1,
      label + ': gate ledger names the desk floor, not the old hardcode ("' + gateLabel + '")');
    const plans = sandbox.__divPlans || [];
    if (process.env.DIV_DEBUG) console.log('DEBUG ' + label + ' plans: ' + JSON.stringify(plans, null, 1).slice(0, 3000));
    assert(plans.length >= 1, label + ': applyExactEntry ran (plan captured, not just markup)');
    const rrOk = plans.every(function(pl){
      const rr = (pl && pl.rr1 != null && isFinite(+pl.rr1)) ? +pl.rr1
        : Math.abs(pl.t1 - pl.entry) / Math.max(1e-12, Math.abs(pl.entry - pl.stop));
      return rr >= floor - 1e-9;
    });
    assert(rrOk, label + ': every emitted plan clears the desk R:R floor of ' + floor + ' after refinement');
    const geoOk = plans.every(function(pl){
      return pl.dir === 'long' ? (pl.stop < pl.entry && pl.t1 > pl.entry)
                               : (pl.stop > pl.entry && pl.t1 < pl.entry);
    });
    assert(geoOk, label + ': plan geometry is sided correctly (stop behind entry, target ahead)');
    const stat = statEl.textContent;
    assert(/done — [1-9]\d* divergences found/.test(stat),
      label + ': stat line reports the found count honestly (got "' + stat + '")');
  }

  /* ---- 2. the MODERN detector path (structure-core loaded) ---- */
  assert(run('typeof hgDetectDivergences') === 'function', 'structure-core detector is present for the modern path');
  await driveLeg('modern path');

  /* ---- 3. the LEGACY pivot path (detector absent, as when the script
         fails to load — the fallback exists for exactly that) ---- */
  run('window.__savedDivDet = hgDetectDivergences; delete window.hgDetectDivergences;');
  assert(run('typeof hgDetectDivergences') !== 'function', 'detector removed: legacy path is the one under test');
  await driveLeg('legacy path');
  run('window.hgDetectDivergences = window.__savedDivDet;');

  /* ---- 3b. the enricher itself honors a caller floor — the root fix that
         ob (2.5) and smc (3.0) also depend on, driven directly so a leg
         refactor cannot hide an enricher revert ---- */
  const enrichFloored = run('(function(){ var rows=window.__divRows; var p=rows[rows.length-1].c; var pl={ dir:"long", type:"SWING", entry:p, stop:p-2, t1:p+6.5, t2:p+8.5, minRr:3.25 }; var out=hgEnrichSmartPlan(pl, rows); return out ? { rr1: out.rr1, pol: out.targetPolicy } : null; })()');
  assert(enrichFloored && enrichFloored.rr1 >= 3.25 - 1e-9,
    'hgEnrichSmartPlan rebuilds AT the caller floor when one rides in (got rr1 ' + (enrichFloored && enrichFloored.rr1) + ')');
  assert(enrichFloored && /3\.25R/.test(enrichFloored.pol),
    'and the target-policy label names the raised multiple, not the old 2R/3.5R (got "' + (enrichFloored && enrichFloored.pol) + '")');
  const enrichDefault = run('(function(){ var rows=window.__divRows; var p=rows[rows.length-1].c; var pl={ dir:"long", type:"SWING", entry:p, stop:p-2, t1:p+4, t2:p+7 }; var out=hgEnrichSmartPlan(pl, rows); return out ? out.rr1 : null; })()');
  assert(Math.abs((enrichDefault || 0) - 2) < 1e-9,
    'a caller with NO floor still gets the old 2R policy — the default did not move (got rr1 ' + enrichDefault + ')');

  /* ---- 4. static pins on the fix itself, so a revert of either half
         trips this file even if the fixture drifts ---- */
  const legSrc = (function(){
    const i = html.indexOf('async function runDivScanLeg');
    const j = html.indexOf('\nasync function', i + 10);
    return html.slice(i, j > i ? j : undefined);
  })();
  assert(legSrc.indexOf('entry+2*risk') === -1 && legSrc.indexOf('entry-2*risk') === -1,
    'the 2R hardcode that could never clear a 3.25 floor is gone from the leg');
  assert((legSrc.match(/hgTabMinRr\('div'/g) || []).length >= 2,
    'both paths read the tab floor from hgTabMinRr');
  assert(!/const\s+t1\s*=/.test(legSrc) && !/const\s+entry\s*=\s*p;/.test(legSrc),
    'entry/t1 are no longer const where the refinement reassigns them (the swallowed TypeError)');

  /* ---------------- settle & summary ---------------- */
  process.on('unhandledRejection', () => {});
  await new Promise(r => setTimeout(r, 300));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  for (const h of __intervals){ try{ clearInterval(h); }catch(e){} }
  for (const h of __timers){ try{ clearTimeout(h); }catch(e){} }
  await new Promise(r => setTimeout(r, 50));
  if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
  console.log('ALL DIV-SCAN-LEG TESTS PASSED');
  process.exit(0);
})();
