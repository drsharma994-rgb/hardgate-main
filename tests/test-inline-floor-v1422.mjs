/* HARDGATE — hg-v1432 INLINE SCANNERS ADMISSION FLOOR at the shared card seam.

   hg-v1433: sister-suite re-pin — the stamp assertions below follow the tree
   version (now hg-v1433, riding the GOLD SINGLES bump); the pack under test
   remains hg-v1432. Behavior pins unchanged.
   hg-v1434: sister-suite re-pin — same move, riding the CRYPTO SINGLES bump;
   hg-v1435: sister-suite re-pin — same move, riding the PINE/META bump;
   the pack under test remains hg-v1432. Behavior pins unchanged.
   the pack under test remains hg-v1432. Behavior pins unchanged.

   What ships (measured on the wave-A census, desks/inlinescanners/baseline-census.json;
   12 majors, 12.2mo 4h + 6.3wk 15m Binance spot, scanner-own plans, stop-first,
   20-bar horizon, 0.20%/0.04% RT, both chronological halves):

     FLOOR CLAUSES (keyed by scanId, fail-open, demote-not-hide):
       coil      ER(20)>=0.30 chop MARK (dropped cohort -0.188R/-0.320R both halves)
       liq-trap  costR stop>=4x RT DEMOTE (-0.267R/-0.446R) + volZ(20)>=0 DEMOTE
                 (-0.109R/-0.091R)
       swing-near ER(20) record MARK on BEST:swing NEAR rows (-0.023R/-0.015R)
       scalp-near costR record MARK on BEST:scalp NEAR rows (-0.661R/-2.232R)
     LEDGER HONESTY REPAIRS:
       R1 every tier records, ticket-flagged (coil/apex forming and smc/ob near
          printed-and-vanished before; the losing books were unmeasurable)
       R2 the record tf is the scanner's own tape (hgInlineScanTf) — the
          hardcoded '4h' settled liq-trap/scalp 15m plans on 4h bars
       R3 swing/scalp CLEAN no longer double-record (CARD:swing via cardHTML
          AND BEST:swing via the publish); the publish owns those pools now

   MUTATION PROOFS (run during landing, each clause killed -> RED -> revert -> GREEN):
     - HG_INLINE_FLOOR_COST_STOP_FRAC = 0 -> 6 pins RED (both liq-trap costR
       pins, scalp-near helper + publish marks, over-floor pass, record pin);
       reverted GREEN.
     - er < HG_INLINE_FLOOR_ER_MIN -> er < 0 -> 4 pins RED (coil helper +
       card mark, swing-near helper + publish mark); reverted GREEN.
     - vz < 0 -> vz < -99 -> 1 pin RED (liq-trap vol-z demote); reverted GREEN.
     - R1 reverted to tradeable-only recording -> 2 pins RED (forming coil /
       sub-floor trap records); restored GREEN.
     - R3 exclusion removed -> 3 pins RED (CARD:swing/CARD:scalp records +
       static seam pin); restored GREEN.
     Post-proof: 57/57 GREEN.

   Run: node tests/test-inline-floor-v1422.mjs */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0, fail = 0;
function assert(cond, msg){
  if (cond){ pass++; console.log('ok    - ' + msg); }
  else { fail++; console.error('FAIL  - ' + msg); }
}

/* ---------------- stub DOM (same shape as test-div-scan-leg.mjs) ---------------- */
function makeClassList(){
  const s = new Set();
  return { _set: s,
    add(){ for (const c of arguments) s.add(c); },
    remove(){ for (const c of arguments) s.delete(c); },
    toggle(c, force){ const want = (force === undefined) ? !s.has(c) : !!force; if (want) s.add(c); else s.delete(c); return want; },
    contains(c){ return s.has(c); } };
}
function makeEl(tag){
  return { tagName: String(tag || 'div').toUpperCase(), id: '', innerHTML: '', textContent: '', value: '', className: '', type: '',
    disabled: false, checked: false, href: '', src: '', title: '', placeholder: '', style: {}, dataset: {}, children: [], parentNode: null,
    classList: makeClassList(), firstElementChild: { style: {} }, _attrs: {}, _ev: {}, _qs: {},
    addEventListener(ev, fn){ (this._ev[ev] = this._ev[ev] || []).push(fn); },
    removeEventListener(){},
    appendChild(c){ this.children.push(c); c.parentNode = this; return c; },
    insertBefore(c, ref){ const i = this.children.indexOf(ref); if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); c.parentNode = this; return c; },
    removeChild(c){ const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    remove(){ if (this.parentNode) this.parentNode.removeChild(this); },
    setAttribute(k, v){ this._attrs[k] = String(v); },
    getAttribute(k){ return (k in this._attrs) ? this._attrs[k] : null; },
    querySelector(sel){ if (!this._qs[sel]) this._qs[sel] = makeEl('div'); return this._qs[sel]; },
    querySelectorAll(){ return []; },
    insertAdjacentHTML(pos, html){ this.innerHTML += html; },
    focus(){}, blur(){}, click(){}, getContext(){ return null; },
    cloneNode(){ return makeEl(this.tagName); }, contains(){ return false; }, offsetWidth: 0, offsetHeight: 0 };
}
const byId = new Map();
const documentStub = {
  getElementById(id){ if (!byId.has(id)) byId.set(id, makeEl('div')); const el = byId.get(id); el.id = id; return el; },
  createElement(tag){ return makeEl(tag); },
  createTextNode(t){ return { textContent: String(t) }; },
  querySelector(sel){ return makeEl('div'); },
  querySelectorAll(){ return []; },
  addEventListener(){}, removeEventListener(){},
  body: makeEl('body'), head: makeEl('head'), documentElement: makeEl('html'),
  activeElement: null, title: '', hidden: false, visibilityState: 'visible'
};
const storeMem = new Map();
const localStorageStub = {
  getItem(k){ return storeMem.has(k) ? storeMem.get(k) : null; },
  setItem(k, v){ storeMem.set(k, String(v)); },
  removeItem(k){ storeMem.delete(k); }, clear(){ storeMem.clear(); }
};
function WebSocketStub(){ this.readyState = 0; }
WebSocketStub.OPEN = 1; WebSocketStub.CONNECTING = 0; WebSocketStub.CLOSING = 2; WebSocketStub.CLOSED = 3;
WebSocketStub.prototype.send = function(){};
WebSocketStub.prototype.close = function(){ this.readyState = 3; };
WebSocketStub.prototype.addEventListener = function(){};
const fetchStub = async () => ({ ok: false, status: 503, statusText: 'stubbed', json: async () => ({}), text: async () => '' });
const __timers = [], __intervals = [];
const trackedSetTimeout = (fn, ms, ...args) => { const h = setTimeout(fn, ms, ...args); __timers.push(h); return h; };
const trackedSetInterval = (fn, ms, ...args) => { const h = setInterval(fn, ms, ...args); __intervals.push(h); return h; };
const sandbox = {
  console, setTimeout: trackedSetTimeout, clearTimeout, setInterval: trackedSetInterval, clearInterval,
  AbortController, queueMicrotask,
  document: documentStub, localStorage: localStorageStub, sessionStorage: localStorageStub,
  fetch: fetchStub, WebSocket: WebSocketStub,
  emailjs: { init(){}, send: async () => ({ status: 0, text: 'stubbed' }) },
  navigator: { clipboard: { writeText: async () => {} } },
  alert(){}, confirm(){ return true; }, prompt(){ return ''; }
};
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
function load(name){ vm.runInContext(readFileSync(path.join(root, name), 'utf8'), ctx, { filename: name }); }

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
assert(blocks.length === 6, 'index.html yields exactly 6 non-empty inline <script> blocks (got ' + blocks.length + ')');
loadErr = null;
try{
  load('hg-plan.js');
  load('backtest-tab-params.js');
  load('structure-core.js');
  blocks.forEach((body, i) => vm.runInContext(body, ctx, { filename: 'index.html:inline-' + (i + 1) }));
}catch(e){ loadErr = e; }
assert(!loadErr, 'inline blocks execute without throwing' + (loadErr ? ' — got: ' + (loadErr && loadErr.stack ? loadErr.stack.split('\n').slice(0, 3).join(' | ') : '') : ''));
const run = code => vm.runInContext(code, ctx);
run('(function(){ try{ if (S.alertTimer) clearInterval(S.alertTimer); }catch(e0){} S.alertTimer=null; S.alertBusy=false; S.alertsOn=false; __hgTabScanSeq=(__hgTabScanSeq||0)+1000; if (typeof hgScanAllTabs==="function") hgScanAllTabs=async function(){ return { refreshed:0, skipped:0, failed:0, failedNames:[] }; }; })()');

/* capture the choke point's records */
sandbox.__FWD = [];
run('hgFwdRecordScan = function(tab, tf, list, opts){ window.__FWD.push({ tab: tab, tf: tf, list: list, opts: opts }); return list.length; };');

/* ---------------- fixtures ---------------- */
const T0 = 1700000000;
function mkRows(kind, n){
  /* kind 'chop': alternating closes -> ER(20) ~ 0; 'trend': linear ramp ->
     ER(20) ~ 1. Volume flat 100 except a final-bar spike when kind has
     '+vol' (volZ(20) > 0). */
  const out = [];
  for (let i = 0; i < n; i++){
    const c = kind.startsWith('trend') ? 90 + i * 0.3 : 100 + (i % 2 ? 0.4 : -0.4);
    /* alternating volume so the volZ window has real variance (volZ's
       window EXCLUDES the last bar, indicators.js:103): drying last bar ->
       volZ(20) << 0; a '+vol' spike -> volZ(20) >> 0 */
    out.push({ t: T0 + i * 14400, o: c - 0.05, h: c + 0.3, l: c - 0.3, c: c, v: (i % 2 ? 300 : 100) });
  }
  out[out.length - 1].v = kind.endsWith('+vol') ? 800 : 40;
  return out;
}
const chopRows = mkRows('chop', 60);
const trendRowsVol = mkRows('trend+vol', 60);
const chopRowsVol = mkRows('chop+vol', 60);

(async function main(){

  console.log('== 1) the helper: clauses keyed by scanId, fail-open ==');
  assert(run('typeof hgInlineScanFloor') === 'function', 'hgInlineScanFloor exists at the seam');
  assert(run('typeof hgInlineScanTf') === 'function', 'hgInlineScanTf exists');

  sandbox.__chop = chopRows; sandbox.__trendV = trendRowsVol; sandbox.__chopV = chopRowsVol;

  /* coil: chop MARK, never demote (forming tier has no ticket) */
  let r = run('hgInlineScanFloor("coil", { dir:"long", entry:100, stop:98, t1:106 }, window.__chop)');
  assert(r.marks.length === 1 && /ER\(20\)/.test(r.marks[0]) && r.demote === false,
    'coil: choppy tape earns the CHOP STAND-ASIDE mark (cohort -0.188R/-0.320R) — a mark, not a demote');
  r = run('hgInlineScanFloor("coil", { dir:"long", entry:100, stop:98, t1:106 }, window.__trendV)');
  assert(r.marks.length === 0 && r.demote === false, 'coil: trending tape passes clean');
  r = run('hgInlineScanFloor("coil", { dir:"long", entry:100, stop:98, t1:106 }, null)');
  assert(r.marks.length === 0 && r.abstained.indexOf('er20') >= 0, 'coil: no rows -> abstain (fail-open third state), no mark');

  /* liq-trap: costR DEMOTE + volz DEMOTE */
  r = run('hgInlineScanFloor("liq-trap", { dir:"long", entry:100, stop:99.6, t1:101 }, window.__chopV)');
  assert(r.demote === true && /UNDER THE COST FLOOR/.test(r.reasons.join(' ')),
    'liq-trap: 0.40% stop < 4x the 0.20% RT demotes, reason named (cohort -0.267R/-0.446R)');
  r = run('hgInlineScanFloor("liq-trap", { dir:"long", entry:100, stop:99.0, t1:103 }, window.__chop)');
  assert(r.demote === true && /vol z/.test(r.reasons.join(' ')),
    'liq-trap: volZ(20) < 0 (flat volume, no spike) demotes, reason named (cohort -0.109R/-0.091R)');
  r = run('hgInlineScanFloor("liq-trap", { dir:"long", entry:100, stop:99.0, t1:103 }, window.__chopV)');
  assert(r.demote === false && r.reasons.length === 0, 'liq-trap: 1.0% stop on a volume spike passes');
  r = run('hgInlineScanFloor("liq-trap", { dir:"long", entry:NaN, stop:99.6, t1:101 }, window.__chopV)');
  assert(r.demote === false && r.abstained.indexOf('costR') >= 0, 'liq-trap: unreadable geometry abstains — never a demote');

  /* swing-near / scalp-near: record marks */
  r = run('hgInlineScanFloor("swing-near", { dir:"long", entry:100, stop:97, t1:106 }, window.__chop)');
  assert(r.marks.length === 1 && /ER\(20\)/.test(r.marks[0]) && r.demote === false, 'swing-near: chop mark for the BEST:swing NEAR record');
  r = run('hgInlineScanFloor("scalp-near", { dir:"long", entry:100, stop:99.6, t1:101 }, window.__chopV)');
  assert(r.marks.length === 1 && /COST FLOOR/.test(r.marks[0]) && r.demote === false, 'scalp-near: sub-4xRT stop mark for the BEST:scalp NEAR record');

  /* refused scanners carry NO clause */
  for (const sid of ['divergence', 'smc', 'ob', 'apex', 'coil-expansion', 'swing', 'scalp']){
    r = run(`hgInlineScanFloor(${JSON.stringify(sid)}, { dir:"long", entry:100, stop:99.6, t1:101 }, window.__chop)`);
    assert(r.demote === false && r.marks.length === 0,
      sid + ': no clause — refused on measurement, the book is untouched');
  }

  /* levers */
  run('window.HG_INLINE_FLOOR = false;');
  r = run('hgInlineScanFloor("liq-trap", { dir:"long", entry:100, stop:99.6, t1:101 }, window.__chopV)');
  assert(r.demote === false, 'lever HG_INLINE_FLOOR=false restores pre-v1432 admission');
  run('window.HG_INLINE_FLOOR = true; window["HG_INLINE_FLOOR_LIQ-TRAP"] = false;');
  r = run('hgInlineScanFloor("liq-trap", { dir:"long", entry:100, stop:99.6, t1:101 }, window.__chopV)');
  assert(r.demote === false, 'per-scanner lever HG_INLINE_FLOOR_LIQ-TRAP=false retires one clause set');
  run('delete window["HG_INLINE_FLOOR_LIQ-TRAP"];');

  console.log('== 2) hgInlineScanTf — the scanner\'s own tape ==');
  assert(run('hgInlineScanTf("liq-trap", {})') === '15m', 'liq-trap records on 15m (was hardcoded 4h)');
  assert(run('hgInlineScanTf("scalp", {})') === '15m', 'scalp records on 15m');
  assert(run('hgInlineScanTf("apex", {})') === '1h', 'apex records on 1h');
  assert(run('hgInlineScanTf("divergence", {})') === '4h' && run('hgInlineScanTf("coil", {})') === '4h'
    && run('hgInlineScanTf("smc", {})') === '4h' && run('hgInlineScanTf("ob", {})') === '4h',
    'the 4h scanners stay 4h');
  assert(run('hgInlineScanTf("liq-trap", { tf: "5m" })') === '5m', 'an explicit bookMeta.tf wins');

  console.log('== 3) cardHTML integration — demote-not-hide, every tier records ==');
  function driveCard(label, js){
    sandbox.__FWD.length = 0;
    const out = run(js);
    return { out, recs: sandbox.__FWD.slice() };
  }
  /* 3a. liq-trap CLEAN-shaped card with a sub-floor stop: prints, NEAR label,
         floor reason named, no trade button, recorded ticket:false on 15m */
  let d = driveCard('trap-subfloor',
    'cardHTML("TESTUSD", "long", [["mark","100"]], ["G1"], "STOP 99.60 · T1 101.00", 100, 99.6, 101, null, { scanner: "liq-trap", strategy: "liq-trap", rows: window.__chopV })');
  assert(d.out.indexOf('class="card ') !== -1 && d.out.indexOf('STOP') !== -1,
    'liq-trap sub-floor: the card still PRINTS with its levels (demote, never hide)');
  assert(d.out.indexOf('NEAR') !== -1 && d.out.indexOf('SEND TO TRADE PLAN') === -1,
    'liq-trap sub-floor: tier drops to NEAR and the trade button is withheld');
  assert(d.out.indexOf('ADMISSION FLOOR') !== -1 && d.out.indexOf('UNDER THE COST FLOOR') !== -1,
    'liq-trap sub-floor: the floor reason is named on the card');
  assert(d.recs.length === 1 && d.recs[0].tab === 'CARD:liq-trap' && d.recs[0].tf === '15m'
    && d.recs[0].list[0].ticket === false && /COST FLOOR/.test((d.recs[0].list[0].floorMarks || []).join(' ')),
    'liq-trap sub-floor: recorded ticket:false on the 15m tape WITH the floor mark (the floor can be judged)');

  /* 3b. liq-trap over the floor: CLEAN, button live, ticket:true, 15m */
  d = driveCard('trap-good',
    'cardHTML("TESTUSD", "long", [["mark","100"]], ["G1"], "STOP 99.00 · T1 103.00", 100, 99.0, 103, null, { scanner: "liq-trap", strategy: "liq-trap", rows: window.__chopV })');
  assert(d.out.indexOf('CLEAN') !== -1 && d.out.indexOf('SEND TO TRADE PLAN') !== -1 && d.out.indexOf('ADMISSION FLOOR') === -1,
    'liq-trap over-floor: CLEAN card, button live, no floor banner');
  assert(d.recs.length === 1 && d.recs[0].tf === '15m' && d.recs[0].list[0].ticket === true,
    'liq-trap over-floor: recorded ticket:true on 15m');

  /* 3c. R1: a FORMING coil card records ticket:false and carries the chop mark */
  d = driveCard('coil-forming',
    'cardHTML("TESTUSD", "long", [["mark","100"]], ["G1"], "STOP 98.00 · T1 106.00", 100, 98, 106, null, { scanner: "coil", strategy: "coil", tier: "forming", rows: window.__chop })');
  assert(d.recs.length === 1 && d.recs[0].tab === 'CARD:coil' && d.recs[0].list[0].ticket === false,
    'R1: a forming coil card now RECORDS (ticket:false) — before hg-v1432 it printed and vanished');
  assert(/ER\(20\)/.test((d.recs[0].list[0].floorMarks || []).join(' ')) && d.out.indexOf('CHOP STAND-ASIDE') !== -1,
    'coil forming: the chop mark rides the record AND prints on the card');
  assert(d.out.indexOf('SEND TO TRADE PLAN') === -1, 'coil forming: never tradeable, floor or no floor');

  /* 3d. R1: smc NEAR records ticket:false on 4h */
  d = driveCard('smc-near',
    'cardHTML("TESTUSD", "long", [["mark","100"]], ["G1"], "STOP 98.00 · T1 106.00", 100, 98, 106, null, { scanner: "smc", strategy: "smc", tier: "near", rows: window.__trendV })');
  assert(d.recs.length === 1 && d.recs[0].tab === 'CARD:smc' && d.recs[0].tf === '4h' && d.recs[0].list[0].ticket === false,
    'R1: an smc NEAR card records ticket:false on 4h (coinglass-dark evidence now converges)');

  /* 3e. apex FORMING records on 1h */
  d = driveCard('apex-forming',
    'cardHTML("TESTUSD", "long", [["mark","100"]], ["G1"], "STOP 98.00 · T1 106.00", 100, 98, 106, null, { scanner: "apex", strategy: "apex", tier: "forming", rows: window.__trendV })');
  assert(d.recs.length === 1 && d.recs[0].tab === 'CARD:apex' && d.recs[0].tf === '1h' && d.recs[0].list[0].ticket === false,
    'R1+R2: apex forming records ticket:false on its 1h tape');

  /* 3f. div CLEAN unchanged: ticket:true, 4h, no banner */
  d = driveCard('div-clean',
    'cardHTML("TESTUSD", "long", [["mark","100"]], ["G1"], "STOP 98.00 · T1 106.00", 100, 98, 106, null, { scanner: "divergence", strategy: "divergence", rows: window.__trendV })');
  assert(d.recs.length === 1 && d.recs[0].list[0].ticket === true && d.recs[0].tf === '4h' && d.out.indexOf('ADMISSION FLOOR') === -1,
    'divergence keeps its green book untouched: CLEAN ticket:true on 4h, no floor clause');

  /* 3g. R3: swing/scalp CLEAN no longer double-record at the card seam */
  d = driveCard('swing-clean',
    'cardHTML("TESTUSD", "long", [["mark","100"]], ["G1"], "STOP 98.00 · T1 106.00", 100, 98, 106, null, { scanner: "swing", strategy: "swing", rows: window.__trendV })');
  assert(d.recs.length === 0, 'R3: CARD:swing does not record from cardHTML — BEST:swing owns the pool (was double-counted)');
  assert(d.out.indexOf('SEND TO TRADE PLAN') !== -1, 'R3: the swing card itself is unchanged — button live');
  d = driveCard('scalp-clean',
    'cardHTML("TESTUSD", "long", [["mark","100"]], ["G1"], "STOP 99.00 · T1 103.00", 100, 99, 103, null, { scanner: "scalp", strategy: "scalp", rows: window.__chopV })');
  assert(d.recs.length === 0, 'R3: CARD:scalp does not record from cardHTML either');

  /* 3h. a card without committed levels still records nothing */
  d = driveCard('no-levels',
    'cardHTML("TESTUSD", "long", [["mark","100"]], ["G1"], "levels unavailable — size down", null, null, null, null, { scanner: "coil", strategy: "coil", tier: "forming", rows: window.__chop })');
  assert(d.recs.length === 0, 'no committed levels -> no record (there is no plan to settle)');

  console.log('== 4) the publish seam — NEAR rows carry the measured marks ==');
  sandbox.__FWD.length = 0;
  await run('hgPublishCryptoScanSnap("swing", [], [{ sym:"NEARUSD", dir:"long", entry:100, stop:97, t1:106, rows: window.__chop }], "test", {}, null)');
  let pub = sandbox.__FWD.filter(x => x.tab === 'BEST:swing');
  assert(pub.length === 2 && pub[1].list[0].ticket === false && /ER\(20\)/.test((pub[1].list[0].floorMarks || []).join(' ')),
    'swing-near publish: the NEAR record carries the ER(20) chop mark (cohort -0.023R/-0.015R)');
  sandbox.__FWD.length = 0;
  await run('hgPublishCryptoScanSnap("scalp", [], [{ sym:"NEARUSD", dir:"long", entry:100, stop:99.6, t1:101, rows: window.__chopV }], "test", {}, null)');
  pub = sandbox.__FWD.filter(x => x.tab === 'BEST:scalp');
  assert(pub.length === 2 && /COST FLOOR/.test((pub[1].list[0].floorMarks || []).join(' ')),
    'scalp-near publish: the NEAR record carries the cost-floor mark (cohort -0.661R/-2.232R)');
  sandbox.__FWD.length = 0;
  await run('hgPublishCryptoScanSnap("swing", [], [{ sym:"NEARUSD", dir:"long", entry:100, stop:97, t1:106 }], "test", {}, null)');
  pub = sandbox.__FWD.filter(x => x.tab === 'BEST:swing');
  assert(pub.length === 2 && pub[1].list[0].floorMarks === undefined,
    'publish seam fails open: a NEAR row without rows records unmarked');

  console.log('== 5) static pins on the seam ==');
  const iHelper = html.indexOf('function hgInlineScanFloor(scanId, cand, rows)');
  const iCard = html.indexOf('function cardHTML(sym, dir, mini, gates, plan, entry, stop, t1, chartId, bookMeta){');
  assert(iHelper > -1 && iHelper < iCard, 'the floor helper is defined before cardHTML in the inline block');
  assert(/hgFwdRecordScan\('CARD:' \+ scanId, hgInlineScanTf\(scanId, bookMeta\)/.test(html),
    'the record call passes the scanner-tape tf (R2)');
  assert(/ticket: tradeable/.test(html), 'the record carries ticket: tradeable (R1)');
  assert(/scanId !== 'swing' && scanId !== 'scalp'/.test(html), 'the swing/scalp dedupe exclusion is on the record gate (R3)');
  assert((html.match(/HG_INLINE_FLOOR/g) || []).length >= 2, 'the master lever + per-scanner lever are named at the seam');
  assert(/floorMarks/.test(html), 'floor marks ride the records');

  console.log('== 6) the stamp ==');
  {
    assert(HG_VER === 'hg-v1450', 'build-stamp version is hg-v1450 (got ' + HG_VER + ')');
    assert(swCacheOk(readFileSync(path.join(root, 'sw.js'), 'utf8')), 'sw.js HG_CACHE is ' + HG_VER);
    assert(!/\?v=1433/.test(html), 'index.html carries no ?v=1433 byte left');
    assert(/hg-v1435/.test(readFileSync(path.join(root, 'AGENTS.md'), 'utf8')), 'AGENTS.md records hg-v1435');
    assert(/hg-v1433/.test(readFileSync(path.join(root, 'AGENTS.md'), 'utf8')), 'AGENTS.md still records hg-v1433');
    assert(/hg-v1432/.test(readFileSync(path.join(root, 'AGENTS.md'), 'utf8')), 'AGENTS.md still records hg-v1432');
  }

  /* ---------------- settle & summary ---------------- */
  process.on('unhandledRejection', () => {});
  await new Promise(r => setTimeout(r, 300));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  for (const h of __intervals){ try{ clearInterval(h); }catch(e){} }
  for (const h of __timers){ try{ clearTimeout(h); }catch(e){} }
  await new Promise(r => setTimeout(r, 50));
  if (fail > 0){ console.error('TESTS FAILED'); process.exit(1); }
  console.log('ALL INLINE-FLOOR-v1422 TESTS PASSED');
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
