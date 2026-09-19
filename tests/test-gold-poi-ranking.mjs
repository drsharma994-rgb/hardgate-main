/* HARDGATE — a helper that does not exist was killing the gold desk's best
   entry point of interest, every time it found one.

   formation.js line 279, inside hgRankEntryPOI, read:

     if (ob && fin(+ob.entry)){ cands.push({ score: 90, poi: 'ob', ... }); }

   `fin` is defined NOWHERE the browser can see. Not on the window after all
   201 of index.html's scripts have run. Not as a lexical in any of its five
   inline blocks. `typeof fin` is "undefined" and calling it throws a
   ReferenceError.

   That call sits inside hgRankEntryPOI's outer try, and hgDetectOrderBlock is
   a real global that fires on gold often. So the moment an order block was
   detected the ReferenceError unwound the whole function and it returned
   null — not "no order block", but NO POINT OF INTEREST AT ALL. The order
   block (score 90-92) and the FVG on the next line (87-91) are the two
   highest-scoring POIs this desk has, and they took the entire ranking down
   with them whenever either appeared.

   Proven by running it rather than by reading it: with hgDetectOrderBlock
   returning a candidate, hgRankEntryPOI returned null; with the detector
   absent it returned an OTE POI quite happily. That is the shape of the bug —
   it only breaks when it succeeds.

   The same missing name had a second, quieter victim. plans.js line 345 read
   `fin(hit.gatesPassed)` inside the regime-overlay block, whose catch records
   failures into `unchecked`. So the overlay's extra-confluence requirement
   never once ran; it has always reported itself unchecked instead. Two lines
   further down that same file guards the identical name with
   `typeof fin === 'function'`. One site guarded, one not.

   Both now use the house rule their own file already had — formation's hgFin,
   plans' hgPlanNum — given the RAW value so a null or an empty string reads
   as NaN rather than as the price zero.

   WHY A SOURCE SCAN WOULD NOT HAVE FOUND THIS, and why this file runs things.
   A scan for undefined identifiers drowns: 126 names in this repo look
   undefined to a static reader and almost all are local variables and
   callback parameters a scanner cannot see. `last`, sitting right beside
   `fin` in the same files, looks identical to a scanner and is perfectly
   fine — it is an index.html inline declaration and resolves as a bare
   identifier. The difference is only visible by executing.

   Run: node tests/test-gold-poi-ranking.mjs */
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





console.log('== the app comes up, and the POI ranker is reachable ==');
const FED = await sweep(false);
const W = FED.win;
{
  ok(FED.failed.length === 0, `all ${SCRIPTS.length} of index.html's external scripts ran`);
  ok(typeof W.hgRankEntryPOI === 'function', 'hgRankEntryPOI is exported');
  ok(typeof W.hgDetectOrderBlock === 'function',
     'and hgDetectOrderBlock is a real global — this path is reached in production, not hypothetically');
}

/* a deterministic tape, and a detector we control */
function tape(n){
  let p = 4000; const rows = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + ((i * 7919 % 97) / 97 - 0.48) * 0.004);
    const r = p * 0.003;
    rows.push({ t: 1700000000 + i * 3600, o: p - r * 0.3, h: p + r, l: p - r, c: p, v: 900 });
  }
  return rows;
}
const ROWS = tape(300);
const MARK = ROWS[ROWS.length - 1].c;
const withOb = ob => { const keep = W.hgDetectOrderBlock; W.hgDetectOrderBlock = () => ob;
                       try { return W.hgRankEntryPOI(ROWS, 'long', 'swing', MARK, 5, undefined); }
                       finally { W.hgDetectOrderBlock = keep; } };

console.log('\n== an order block no longer takes the whole ranking down with it ==');
{
  const poi = withOb({ entry: MARK, label: 'order block' });
  ok(poi !== null, 'hgRankEntryPOI returns a point of interest when an order block is detected');
  ok(poi && poi.poi === 'ob' && poi.score >= 90,
     `and it is the order block itself — poi ${poi && poi.poi}, score ${poi && poi.score}, the highest this desk ranks`);
  ok(poi && Math.abs(poi.entry - MARK) < 1e-9, `priced at the block's own entry (${poi && poi.entry.toFixed(2)})`);

  /* the control: it was never the detector's mere presence that mattered */
  const keep = W.hgDetectOrderBlock;
  W.hgDetectOrderBlock = undefined;
  const without = W.hgRankEntryPOI(ROWS, 'long', 'swing', MARK, 5, undefined);
  W.hgDetectOrderBlock = keep;
  ok(without !== null && without.poi !== 'ob',
     `with no order block detector at all the ranker still answers (${without && without.poi}) — `
     + 'which is what made the bug invisible: it only broke when the detector SUCCEEDED');
}

console.log('\n== and a block with no usable entry is skipped, not priced at zero ==');
{
  for (const [label, bad] of [['null', null], ['an empty string', ''], ['undefined', undefined]]){
    const poi = withOb({ entry: bad, label: 'holed block' });
    ok(poi !== null, `an order block whose entry is ${label} does not kill the ranker either`);
    ok(poi && poi.poi !== 'ob', `and it is not offered as a POI (fell through to ${poi && poi.poi})`);
    ok(poi && poi.entry > 3000, `with a real price on whatever did win (${poi && poi.entry.toFixed(2)}), not 0`);
  }
}

console.log('\n== `fin` really is undefined, and `last` really is not ==');
{
  ok(typeof W.fin === 'undefined', 'window.fin is undefined after every external script has run');
  const inlineBlocks = [...INDEX.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  /* TOP-LEVEL only. There IS a `fin` in index.html — and finding it is what
     makes this bug so easy to write. It sits at line 7233, indented two
     spaces, INSIDE goldSetupDecision(), the inline GOLD SETUP tab's own
     decision function:  const fin = function(x){ ... };  A local of one
     function, five thousand lines from formation.js, in a gold routine. The
     name is real, it is even a gold helper, and it is reachable from exactly
     one place that is not here. */
  const topLevelFin = inlineBlocks.some(b =>
    /(^|\n)(?:function\s+fin\s*\(|(?:const|let|var)\s+fin\s*[=(])/.test(b));
  ok(!topLevelFin, 'no inline block declares fin at top level, so a bare call to it throws');
  const nestedFin = inlineBlocks.some(b => /\n\s+const fin = function/.test(b));
  ok(nestedFin,
     'there IS one nested inside goldSetupDecision(), which is how a call to it came to look plausible — '
     + 'a real gold helper, one scope deep, unreachable from any other file');
  /* the near-miss that makes a source scan useless here */
  const declaresLast = inlineBlocks.some(b => /(^|\n)\s*(?:function\s+last\s*\(|(?:const|let|var)\s+last\s*[=(])/.test(b));
  ok(declaresLast,
     '`last`, which the same files call the same way and which a scanner cannot tell apart, IS declared inline '
     + '— so it resolves as a bare identifier and has always worked');
  ok(typeof W.last === 'undefined',
     'even though window.last is undefined too — the difference is not visible from the window, only from running it');
}

console.log('\n== neither file calls the name that does not exist any more ==');
{
  const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  for (const f of ['formation.js', 'plans.js']){
    const src = strip(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    const bare = [...src.matchAll(/(?:^|[^\w$.])fin\s*\(/g)].length;
    const guarded = [...src.matchAll(/typeof\s+fin\s*===\s*['"]function['"]/g)].length;
    ok(bare === guarded,
       `${f}: ${bare} call${bare === 1 ? '' : 's'} to fin, ${guarded} of them behind a typeof guard — none unguarded`);
  }
  const fm = strip(fs.readFileSync(path.join(ROOT, 'formation.js'), 'utf8'));
  ok(/isFinite\(hgFin\(ob\.entry\)\)/.test(fm) && /isFinite\(hgFin\(fvgD\.entry\)\)/.test(fm),
     'and both formation sites use hgFin on the RAW value, so null and empty string read as NaN and not as zero');
  const pl = strip(fs.readFileSync(path.join(ROOT, 'plans.js'), 'utf8'));
  ok(/hgPlanNum\(hit\.gatesPassed\)/.test(pl),
     'while plans.js uses hgPlanNum, the rule that file already carried, rather than a fourth copy of it');
}

console.log('\n== the gold family still renders, and renders the same way ==');
{
  const prices = [];
  for (const id of FED.live) for (const p of (FED.out[id].txt.match(/\b\d{4,5}\.\d+\b/g) || [])) prices.push(p);
  ok(FED.live.length >= 14, `${FED.live.length} gold tabs driven through their own scan control`);
  ok(prices.length >= 40, `${prices.length} gold prices rendered across the family`);
  const bad = FED.live.filter(id => /\bNaN\b|\bundefined\b|\[object Object\]/.test(FED.out[id].txt));
  ok(bad.length === 0, 'and none of them prints NaN, undefined or [object Object]' + (bad.length ? ': ' + bad.join(', ') : ''));
}

console.log('\n' + passed + ' passed, 0 failed');
