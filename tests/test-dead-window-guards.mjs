/* HARDGATE — the capability checks that can never be true, counted and pinned.

   Pack 848 found that goldpine guarded on `typeof W.px === 'function'` for a
   formatter that is declared `const` in an index.html inline block — and a
   top-level const does not attach to the global object, so the guard had
   always been false. This file asks the obvious next question: how many more
   of those are there, across the whole app.

   The answer is small and now fixed in place. Of the 140 top-level const/let
   names index.html declares inline, exactly THREE are feature-checked on the
   window by external files, and every one of those checks has always failed:

     px       11 files   the adaptive price formatter
     fmt       7 files   the grouped number formatter
     nowSec    1 file    the whole-second clock

   Nineteen guards, three capabilities, none of them ever reached.

   WHAT WAS DONE WITH THAT, WHICH IS NOT WHAT IT LOOKS LIKE. The obvious fix
   is to put the three on the window and revive nineteen guards at a stroke.
   Measured, that is wrong for gold: the house px rounds a four-figure price
   to ONE decimal and groups it, so reviving it would print gold as 4,050.6
   on GOLD PINE while OMNIGOLD, GOLD SCALP and GOLD SWING all print 4050.62.
   The delegation would cost this desk a decimal and split it from its family.
   The house fmt groups thousands, which no gold card does. So the gold tab's
   two dead guards are REMOVED — the fallback is the intended path and the
   guard implied a capability the file was waiting for — and the others are
   left in place and counted here rather than churned.

   nowSec was the one worth repairing. Two files stood in for it. execute.js
   used Math.floor(Date.now()/1000), exactly what the house does. squeeze.js
   used Date.now()/1000, unfloored — so that one desk alone carried a
   fractional clock where the rest of the app carries a whole second.

   A NOTE ON THE SCANNER, because this same mistake has now been made three
   times in three packs. A source scan that looks for a pattern will find that
   pattern inside the COMMENT that explains why the pattern was removed. Pack
   847 read String(+n) out of its own fix note, pack 849 read this very guard
   out of the note above it in goldpine.js. Comments are stripped before any
   scan below.

   Run: node tests/test-dead-window-guards.mjs */
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




const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/* Names index.html holds only as a global LEXICAL binding: reachable as a
   bare identifier by any later classic script, never as window.X. */
const INLINE_BLOCKS = [...INDEX.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const lexical = new Map();
for (let i = 0; i < INLINE_BLOCKS.length; i++)
  for (const m of INLINE_BLOCKS[i].matchAll(/^(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/gm))
    if (!lexical.has(m[1])) lexical.set(m[1], i);

const JS = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));
const guards = new Map();
for (const f of JS){
  const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const add = n => { if (!guards.has(n)) guards.set(n, new Set()); guards.get(n).add(f); };
  for (const m of src.matchAll(/typeof\s+(?:W|window|globalThis)\.([A-Za-z_$][\w$]*)\s*===\s*['"]function['"]/g)) add(m[1]);
  for (const m of src.matchAll(/gfn\(['"]([A-Za-z_$][\w$]*)['"]\)/g)) add(m[1]);
}

console.log('== the app comes up, and we can ask it what is on the window ==');
const FED = await sweep(false);
{
  ok(FED.failed.length === 0, `all ${SCRIPTS.length} of index.html's external scripts ran`);
  ok(lexical.size >= 100, `index.html declares ${lexical.size} top-level const/let names in its inline blocks`);
  ok(guards.size >= 300, `external files feature-check ${guards.size} distinct names on the window`);
}

console.log('\n== exactly three of those checks can never be true ==');
const dead = [];
{
  for (const [name, files] of guards){
    if (!lexical.has(name)) continue;               /* not an inline lexical at all */
    if (typeof FED.win[name] === 'function') continue;  /* something else puts it on the window */
    dead.push({ name, files: [...files].sort() });
  }
  dead.sort((a, b) => b.files.length - a.files.length);
  ok(dead.length === 3,
     `${dead.length} names: ${dead.map(d => d.name + ' (' + d.files.length + ')').join(', ')}`);
  const byName = Object.fromEntries(dead.map(d => [d.name, d.files]));
  for (const n of ['px', 'fmt', 'nowSec'])
    ok(!!byName[n], `${n} is one of them — guarded in ${byName[n] ? byName[n].length : 0} files and never once found`);
  ok(dead.reduce((a, d) => a + d.files.length, 0) === 19,
     `${dead.reduce((a, d) => a + d.files.length, 0)} file-level guards in total, which is the number to watch: `
     + 'a new one means somebody guarded on the window for something declared const inline');
  /* And the mechanism, shown rather than asserted. */
  const probe = {}; probe.window = probe; probe.globalThis = probe;
  vm.createContext(probe);
  vm.runInContext('const a = () => 1; function b(){ return 1; }', probe);
  ok(typeof probe.b === 'function' && typeof probe.a === 'undefined',
     'in one classic script a top-level function reaches window and a top-level const does not');
}

console.log('\n== and none of them is on a gold tab any more ==');
{
  /* The gold family's own module files, resolved from the nav group the way
     pack 845 does it, so this cannot drift as tabs are added. */
  const owners = {};
  for (const f of JS){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const id of GOLD) if (new RegExp("id:\\s*'" + id.replace('-', '\\-') + "'").test(src)) owners[id] = f;
  }
  const goldFiles = new Set(Object.values(owners));
  ok(goldFiles.size >= 10, `${goldFiles.size} gold tab modules resolved from the nav group`);
  const offenders = dead.flatMap(d => d.files.filter(f => goldFiles.has(f)).map(f => `${f} guards on W.${d.name}`));
  ok(offenders.length === 0,
     'no gold tab module carries a guard that can never be true'
     + (offenders.length ? ('\n      ' + offenders.join('\n      ')) : ''));
  const gp = stripComments(fs.readFileSync(path.join(ROOT, 'goldpine.js'), 'utf8'));
  ok(!/typeof\s+W\.px\s*===/.test(gp) && !/typeof\s+W\.fmt\s*===/.test(gp),
     'GOLD PINE in particular no longer implies it is waiting for a formatter that cannot arrive');
}

console.log('\n== reviving px would have cost gold a decimal, which is why it was not ==');
{
  const decl = INLINE_BLOCKS.join('\n').match(/^const px\s*=[\s\S]*?\n\};/m);
  ok(!!decl, 'the house px is readable out of index.html');
  ok(/a>=1000\?1/.test(decl[0].replace(/\s+/g, '')),
     'and it rounds a four-figure price to ONE decimal');
  /* What the gold family actually prints, from the corpus rather than belief. */
  const prices = [];
  for (const id of FED.live) for (const p of (FED.out[id].txt.match(/\b\d{4,5}\.\d+\b/g) || [])) prices.push(p);
  const twoDp = prices.filter(p => (p.split('.')[1] || '').length === 2).length;
  ok(prices.length >= 40 && twoDp === prices.length,
     `all ${prices.length} four-figure prices the gold family renders carry two decimals, not one — `
     + 'delegating to the house px would have made GOLD PINE the only desk printing 4,050.6');
}

console.log('\n== the one dead fallback that did not match what it stands in for ==');
{
  const house = INLINE_BLOCKS.join('\n').match(/^const nowSec\s*=[^\n]*/m);
  ok(!!house && /Math\.floor\(Date\.now\(\)\s*\/\s*1000\)/.test(house[0]),
     'the house nowSec floors to a whole second');
  const sq = stripComments(fs.readFileSync(path.join(ROOT, 'squeeze.js'), 'utf8'));
  ok(/Math\.floor\(Date\.now\(\)\s*\/\s*1000\)/.test(sq),
     'and squeeze.js now floors too — it alone carried a fractional clock');
  ok(!/W\.nowSec/.test(sq), 'with the guard that never fired removed rather than left decorative');
  const ex = stripComments(fs.readFileSync(path.join(ROOT, 'execute.js'), 'utf8'));
  ok(/Math\.floor\(Date\.now\(\)\s*\/\s*1000\)/.test(ex),
     'execute.js keeps its guard, and is named here rather than churned: its fallback already '
     + 'computes exactly what the house does, so the dead guard costs it nothing');
}

console.log('\n' + passed + ' passed, 0 failed');
