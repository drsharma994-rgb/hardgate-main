/* HARDGATE — the gold formation layer survives its own dependencies succeeding.

   Pack 850 found a bug whose whole character was that it only fired when
   something WORKED. formation.js called an undefined `fin` to accept an order
   block, so the instant hgDetectOrderBlock actually returned one, the
   ReferenceError unwound hgRankEntryPOI and it answered null — no point of
   interest at all. With the detector absent, or returning nothing, the ranker
   was perfectly happy. Every test in the suite saw the happy path.

   That is a class, not an incident. formation.js feature-checks 26 optional
   dependencies with `typeof G.X === 'function'`, and each one opens a branch
   that only executes when that dependency is present AND returns something
   usable. A synthetic tape rarely makes them all fire at once, so those
   branches are the least-walked code in the gold desk.

   So this file walks them deliberately. It reads the dependency list out of
   formation.js — not a copy of it, the same discipline pack 845 applied to
   the tab list — forces each one in turn to return a plausible result, and
   requires the ranker to still answer. A new `typeof G.X` in that file joins
   this sweep automatically, and one with no fixture here fails the run rather
   than being skipped quietly.

   The sweep proves it is not vacuous with the two the bug actually killed:
   forcing hgDetectOrderBlock must produce the order-block POI at score 90,
   and hgDetectFvg the FVG at 87. Before pack 850 both produced null.

   Run: node tests/test-gold-dependency-success.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* The app's own list, not a copy of it. */
const groupMatch = INDEX.match(/\{\s*id:\s*'gold',[^}]*tabs:\s*\[([^\]]*)\]/);
const GOLD = groupMatch
  ? groupMatch[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean)
  : [];
const SCRIPTS = [...INDEX.matchAll(/<script src="([A-Za-z0-9._/-]+\.js)(?:\?v=\d+)?"/g)].map(m => m[1]);

/* gold is the legacy GOLD SETUP pane: a <section id="tab_gold"> and a
   <button id="tabB_gold"> written straight into index.html, driven by an
   inline runGoldSetup(). It registers nothing on HG_tabs, so a harness that
   loads scripts cannot reach it. Named here with where it IS covered rather
   than dropped from the count. */
const INLINE = { gold: 'the inline GOLD SETUP pane — runGoldSetup(), driven by test-hard-refresh' };

/* ---------------- a DOM the gold tabs can mount into ---------------- */
function makeDom(sink){
  const byKey = new Map();
  function node(key){
    if (byKey.has(key)) return byKey.get(key);
    const L = Object.create(null);
    const el = {
      _html: '', style: {}, dataset: {}, children: [], disabled: false, checked: false,
      textContent: '', value: '', tagName: 'DIV',
      classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); },
                   toggle(c, o){ o ? this._s.add(c) : this._s.delete(c); }, contains(c){ return this._s.has(c); } },
      appendChild(c){ el.children.push(c); return c; }, removeChild(){}, remove(){},
      setAttribute(k, v){ el.dataset[k] = v; }, getAttribute(){ return null; }, removeAttribute(){},
      closest(){ return null; }, contains(){ return false; },
      addEventListener(t, f){ (L[t] || (L[t] = [])).push(f); }, removeEventListener(){},
      dispatchEvent(ev){ const a = L[(ev && ev.type) || 'click'] || []; let r;
                         for (const f of a){ try { r = f.call(el, ev); } catch (e) {} } return r; },
      click(){ return el.dispatchEvent({ type: 'click', target: el, preventDefault(){}, stopPropagation(){} }); },
      focus(){}, blur(){}, scrollIntoView(){},
      querySelector(s){ return node(key.split('|')[0] + '|' + s); }, querySelectorAll(){ return []; },
      insertAdjacentHTML(_, h){ sink.push(String(h)); },
      getBoundingClientRect(){ return { top: 0, left: 0, width: 100, height: 20, bottom: 20, right: 100 }; },
      _listeners: L
    };
    Object.defineProperty(el, 'innerHTML', {
      get(){ return el._html; }, set(v){ el._html = String(v); sink.push(String(v)); } });
    byKey.set(key, el);
    return el;
  }
  node.__all = () => [...byKey.entries()];
  return node;
}
const T0 = 1700000000 - (1700000000 % 86400);
const TFS = { '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '1d': 86400 };
function bars(n, tf){
  let p = 4000, s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const o = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    o.push({ t: T0 + i * tf, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 900 + rnd() * 1200 });
  }
  return o;
}

function boot(starve){
  const node = makeDom([]);   /* boot-time paint is discarded; each tab gets its own sink below */
  const store = Object.create(null);
  const doc = {
    createElement: t => { const n = node('new:' + t + ':' + Math.random()); n.tagName = String(t || 'div').toUpperCase(); return n; },
    createDocumentFragment: () => node('frag:' + Math.random()), getElementById: id => node('#' + id),
    querySelector: s => node('doc ' + s), querySelectorAll: () => [], head: node('head'), body: node('body'),
    documentElement: node('html'), addEventListener(){}, removeEventListener(){},
    hidden: false, visibilityState: 'visible', cookie: '', title: '', readyState: 'complete'
  };
  const ctx = {
    console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    Math, isFinite, isNaN, parseFloat, parseInt, Number, String, Object, Array, JSON, Date, RegExp,
    Boolean, Set, Map, WeakMap, WeakSet, Symbol, Proxy, Reflect, Function,
    Promise, Error, TypeError, RangeError, NaN, Infinity, Intl,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI, document: doc,
    setTimeout: (f, ms) => globalThis.setTimeout(f, Math.min(Number(ms) || 0, 5)),
    clearTimeout: h => globalThis.clearTimeout(h), setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: f => globalThis.setTimeout(f, 0), cancelAnimationFrame: () => {},
    requestIdleCallback: f => globalThis.setTimeout(f, 0), cancelIdleCallback: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, performance: { now: () => Date.now() },
    TextEncoder, TextDecoder, URL, URLSearchParams, AbortController, structuredClone,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
                    removeItem: k => { delete store[k]; }, clear(){}, key: () => null, length: 0 },
    sessionStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    matchMedia: () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }),
    WebSocket: function(){ this.close = () => {}; this.send = () => {}; this.addEventListener = () => {}; },
    alert(){}, confirm: () => false, prompt: () => null,
    btoa: s => Buffer.from(String(s), 'binary').toString('base64'),
    atob: s => Buffer.from(String(s), 'base64').toString('binary'),
    crypto: { getRandomValues: a => a, randomUUID: () => 'x' }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.location = { href: 'https://x/', search: '', hash: '', protocol: 'https:', host: 'x',
                   hostname: 'x', origin: 'https://x', pathname: '/', reload(){} };
  ctx.navigator = { userAgent: 'node', onLine: true, language: 'en-GB', clipboard: { writeText: () => Promise.resolve() } };
  ctx.fetch = () => Promise.resolve({ ok: true, status: 200, headers: { get: () => null },
    json: () => Promise.resolve({ ok: true, decision: 'HOLD', confidence: 0.5, rationale: 'stub', agents: [], asOf: T0 }),
    text: () => Promise.resolve('{}') });
  vm.createContext(ctx);
  const loaded = [], failed = [];
  for (const f of SCRIPTS){
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)){ failed.push(f + ' (missing)'); continue; }
    try { vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); loaded.push(f); }
    catch (e) { failed.push(f + ' :: ' + e.message.slice(0, 90)); }
  }
  /* THE FEED — every fetcher the gold family reaches for, or nothing at all. */
  const mk = starve ? () => []
                    : (res, count) => bars(Math.max(60, Math.min(200, count || 180)), TFS[String(res)] || 3600);
  ctx.getXAUCandles    = async (r, c) => mk(r, c);
  ctx.getGoldCandles   = async (r, c) => { const w = mk(r, c); return w.length ? { rows: w, source: 'gold-spot' } : null; };
  ctx.getXmGoldCandles = async (r, c) => { const w = mk(r, c); return w.length ? { rows: w, source: 'xm-xauusd' } : null; };
  ctx.binanceKlines    = async (s, r, c) => mk(r, c);
  ctx.dropForming      = r => r;
  return { ctx, node, loaded, failed };
}


const BAD = /\bNaN\b|\bundefined\b|\[object Object\]/;
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* A control worth pressing, and one never to press: this harness must not
   send an order, book a trade or kick a minute-long backtest. */
const RUNISH = /run|scan|build|start|refresh|go\b|calc|analy/i;
const AVOID  = /send|order|xm|post|clear|reset|delete|book|trade|execute|backtest|bt\b/i;

async function sweep(starve){
  const { ctx: C, failed } = boot(starve);
  const reg = new Map((C.HG_tabs || []).filter(t => t && t.id).map(t => [t.id, t]));
  const live = GOLD.filter(id => reg.has(id));
  const out = {};
  for (const id of live){
    const tab = reg.get(id), sink = [], node = makeDom(sink);
    let threw = null; const pressed = [];
    try { tab.mount(node('root:' + id)); } catch (e) { threw = 'mount: ' + e.message.slice(0, 80); }
    try { const r = tab.refresh && tab.refresh(); if (r && r.then) await Promise.race([r, sleep(15000)]); }
    catch (e) { threw = (threw ? threw + ' | ' : '') + 'refresh: ' + e.message.slice(0, 80); }
    await sleep(60);
    const afterRefresh = sink.map(strip).join(' | ');

    const enabled = () => node.__all().filter(([k, el]) => (el._listeners.click || []).length > 0 && !el.disabled);
    const scanOf  = list => list.filter(([k]) => RUNISH.test(k) && !AVOID.test(k))[0];
    const hit = async ([k, el], tag) => {
      try { const r = el.click(); if (r && r.then) await Promise.race([r, sleep(15000)]); pressed.push(tag + k.split('|').pop()); }
      catch (e) { threw = (threw ? threw + ' | ' : '') + 'press: ' + e.message.slice(0, 60); }
      await sleep(100);
    };
    let all = enabled(), armed = false;
    let scan = scanOf(all);
    const scanAtMount = !!scan;
    if (!scan){
      for (const c of all.filter(([k]) => !AVOID.test(k)).slice(0, 2)) await hit(c, 'arm:');
      armed = true;
      all = enabled();
      scan = scanOf(all);
    }
    if (scan) await hit(scan, 'scan:');
    await sleep(250);
    out[id] = { txt: sink.map(strip).join(' | '), afterRefresh, threw, pressed,
                buttons: all.length, scanAtMount, armed, found: !!scan };
  }
  return { out, live, failed, win: C };
}






console.log('== the dependency list comes from formation.js, not from this file ==');
const FORMATION = fs.readFileSync(path.join(ROOT, 'formation.js'), 'utf8');
const DEPS = [...new Set([...FORMATION.matchAll(/typeof\s+G\.([A-Za-z_$][\w$]*)\s*===\s*['"]function['"]/g)].map(m => m[1]))].sort();
const FED = await sweep(false);
const W = FED.win;
{
  ok(FED.failed.length === 0, `all ${SCRIPTS.length} of index.html's external scripts ran`);
  ok(DEPS.length >= 20, `formation.js feature-checks ${DEPS.length} optional dependencies`);
  ok(DEPS.indexOf('hgDetectOrderBlock') >= 0 && DEPS.indexOf('hgDetectFvg') >= 0,
     'including the two whose success used to kill the ranker');
  ok(typeof W.hgRankEntryPOI === 'function' && typeof W.hgFormTicket === 'function',
     'and the formation layer it guards is exported');
}

/* a deterministic tape */
function tape(n){
  let p = 4000; const rows = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + ((i * 7919 % 97) / 97 - 0.48) * 0.004);
    const r = p * 0.003;
    rows.push({ t: 1700000000 + i * 3600, o: p - r * 0.3, h: p + r, l: p - r, c: p, v: 900 + (i % 50) * 10 });
  }
  return rows;
}
const ROWS = tape(300);
const M = ROWS[ROWS.length - 1].c;

/* One plausible success per dependency. A dependency with no fixture is a
   FAILURE below, not a skip — that is what keeps the list honest. */
const RET = {
  hgDetectOrderBlock:  { entry: M - 3, label: 'order block', zone: { lo: M - 6, hi: M - 1 } },
  hgDetectFvg:         { entry: M - 2, label: 'FVG', zone: { lo: M - 5, hi: M } },
  hgDetectLiquiditySweep: { entry: M - 1, label: 'sweep', zone: { lo: M - 4, hi: M + 1 }, swept: true },
  hgOteZone:           { entry: M - 2, lo: M - 6, hi: M, label: 'OTE 70.5%' },
  hgRefineEntry:       { entry: M - 2, label: 'refined' },
  hgStructureStop:     { stop: M - 25, note: 'structure' },
  hgSweepStop:         { stop: M - 28, note: 'sweep' },
  hgPlanFromRisk:      { entry: M, stop: M - 25, t1: M + 50, t2: M + 87, rr: 2 },
  hgPlanSwingTargets:  { t1: M + 50, t2: M + 87, rr: 2, rr1: 2, rr2: 3.5 },
  hgLiveStopScale:     1.1,
  hgSwingAnchorMax:    2.5,
  hgMetaLabel:         { label: 'meta', score: 7 },
  hgHeatProfile:       { maeR: 0.4, mfeR: 1.2 },
  hgWalkForward:       { n: 20, hit: 0.5 },
  hgScoreRecords:      [{ r: 1 }, { r: -1 }],
  hgFormatEntryType:   'LIMIT',
  hgTicketFinalGates:  { ok: true },
  hgSwingPostEnrichValid:  { entry: M, stop: M - 25, t1: M + 50, t2: M + 87 },
  hgScalpPostEnrichValid:  { entry: M, stop: M - 25, t1: M + 40, t2: M + 70 },
  hgLiveFormationSnap: { px: M },
  hgLiveFormationApply:{ ok: true, plan: { entry: M, stop: M - 25, t1: M + 50, t2: M + 87 } },
  hgDeskFormationBoost:{ boost: 1 },
  hgFtFormationBoost:  { boost: 1 },
  hgChartVisionFormationBoost: { boost: 1 },
  goldScalpLevels:     { entry: M, stop: M - 20, t1: M + 40 },
  goldSwingLevels:     { entry: M, stop: M - 30, t1: M + 60 },
  /* the two that a narrower grep for hg-prefixed or gold-prefixed names
     missed, which is why the list is read out of the file with no name
     filter on it at all */
  __gsEntryFromZone:   { entry: M - 2, inZone: true, zone: { lo: M - 5, hi: M + 1 } },
  getDeskMacroCached:  { dxy: 'DOWN', real: 'DOWN', score: 2 }
};

console.log('\n== every dependency has a fixture, so none is skipped quietly ==');
{
  const missing = DEPS.filter(d => !Object.prototype.hasOwnProperty.call(RET, d));
  ok(missing.length === 0,
     `all ${DEPS.length} of them have a plausible success to force`
     + (missing.length ? ' — no fixture for: ' + missing.join(', ') : ''));
  const stale = Object.keys(RET).filter(d => DEPS.indexOf(d) < 0);
  ok(stale.length === 0,
     'and no fixture here is for a dependency formation.js has stopped consulting'
     + (stale.length ? ': ' + stale.join(', ') : ''));
}

console.log('\n== the ranker answers when nothing is forced ==');
const BASE = W.hgRankEntryPOI(ROWS, 'long', 'swing', M, 5, undefined);
{
  ok(BASE !== null, `hgRankEntryPOI returns a POI on a plain tape (${BASE && BASE.poi}, score ${BASE && BASE.score})`);
  ok(BASE && BASE.entry > 3000, `priced at ${BASE && BASE.entry.toFixed(2)}, not zero`);
}

console.log('\n== and it survives each of them succeeding, one at a time ==');
{
  const keep = {}; for (const d of DEPS) keep[d] = W[d];
  const restore = () => { for (const d of DEPS) W[d] = keep[d]; };
  const dead = [], results = {};
  for (const d of DEPS){
    restore();
    const v = RET[d];
    W[d] = function(){ return (v && typeof v === 'object') ? (Array.isArray(v) ? v.slice() : Object.assign({}, v)) : v; };
    let poi = null, err = null;
    try { poi = W.hgRankEntryPOI(ROWS, 'long', 'swing', M, 5, undefined); }
    catch (e){ err = e.name + ': ' + e.message.slice(0, 70); }
    if (poi === null || err) dead.push(`${d} -> ${err || 'null, the ranker died'}`);
    results[d] = poi;
  }
  restore();
  ok(dead.length === 0,
     `all ${DEPS.length} dependencies can succeed without the ranker answering null`
     + (dead.length ? ('\n      ' + dead.join('\n      ')) : ''));

  /* NON-VACUITY: the two that pack 850 fixed must now win the ranking. */
  const ob = results['hgDetectOrderBlock'], fvg = results['hgDetectFvg'];
  ok(ob && ob.poi === 'ob' && ob.score >= 90,
     `forcing hgDetectOrderBlock produces the order-block POI (score ${ob && ob.score}) — it produced null before pack 850`);
  ok(fvg && fvg.poi === 'fvg' && fvg.score >= 87,
     `forcing hgDetectFvg produces the FVG POI (score ${fvg && fvg.score}) — likewise`);
  ok(ob.score > BASE.score && fvg.score > BASE.score,
     `and both outrank what the plain tape offered (${BASE.score}), which is why losing them mattered`);
}

console.log('\n== the ticket builder survives them too ==');
{
  const keep = {}; for (const d of DEPS) keep[d] = W[d];
  const restore = () => { for (const d of DEPS) W[d] = keep[d]; };
  const hit = { dir: 'long', kind: 'TEST', entry: M, stop: M - 25, t1: M + 50, t2: M + 87,
                level: M, zone: { lo: M - 5, hi: M + 5 }, why: 'fixture' };
  const threw = [];
  for (const d of DEPS){
    restore();
    const v = RET[d];
    W[d] = function(){ return (v && typeof v === 'object') ? (Array.isArray(v) ? v.slice() : Object.assign({}, v)) : v; };
    try { W.hgFormTicket(Object.assign({}, hit), { rows: ROWS, style: 'swing', mark: M, atr: 5, minRr: 1.5 }); }
    catch (e){ threw.push(`${d} -> ${e.name}: ${e.message.slice(0, 70)}`); }
  }
  restore();
  ok(threw.length === 0,
     `hgFormTicket does not throw with any one of the ${DEPS.length} dependencies returning a result`
     + (threw.length ? ('\n      ' + threw.join('\n      ')) : ''));
}

console.log('\n== and the family still renders clean ==');
{
  ok(FED.live.length >= 14, `${FED.live.length} gold tabs driven through their own scan control`);
  const bad = FED.live.filter(id => /\bNaN\b|\bundefined\b|\[object Object\]/.test(FED.out[id].txt));
  ok(bad.length === 0, 'none printing NaN, undefined or [object Object]' + (bad.length ? ': ' + bad.join(', ') : ''));
}

console.log('\n' + passed + ' passed, 0 failed');
