/* HARDGATE — every price a gold tab prints is rounded like a price.

   Pack 846 gave the family a harness that presses each gold tab's own scan
   control, so for the first time there is a corpus of what these tabs
   actually render. Reading it turned one up immediately. GOLD PINE printed:

     ENTRY 4050.620761151771 · SL 4069.903921366599 · T1 4045.593761805285

   onto a card carrying SEND TO TRADE PLAN →, while every other gold tab
   printed two decimals. Its PDH, PDL, Asia range and mark went the same way.

   The cause is a dead branch. goldpine.js formats prices through

     function pxF(n){
       if (typeof W.px === 'function') return W.px(n);   // never true
       if (!fin(+n)) return '—';
       return String(+n);                                 // the only path
     }

   and W.px is defined NOWHERE in this repo — no `function px(`, no
   `window.px =`, no `W.px =`, in any .js or in index.html. So the delegation
   has never once fired and every price went out unrounded. The sibling fmtF,
   two lines below it in the same file, falls back to toFixed(2). One file,
   two fallbacks, written to two different standards.

   Seven more files carry the identical line — pine, pinemsb, pineavwap,
   pineht, pinenw, pinerf, pinesmc. They are PINE tabs in MODELS, not gold,
   but it is the same one-line defect with the same live consequence, so they
   are fixed with it rather than left knowing. book.js and chartvision-tab.js
   already round in their own fallbacks, which is where the house rule came
   from.

   This file holds two rules. The runtime one is the real test: drive every
   gold tab through its own scan and require every price-shaped literal it
   renders to carry at most two decimals. The source one keeps the other seven
   honest without booting them.

   BOTH HALVES OF THE px CLAIM WERE WRONG ONCE, AND BOTH ARE WORTH RECORDING.
   The first version proved "no global px" by grepping for `function px(` and
   flagged three files — contract-report.js, gold-seven-step.js, omnigold1.js
   — every one of which defines a px INSIDE an IIFE, where it is module-scoped
   and reaches no window. The claim is now put to the RUNNING app: load all
   201 scripts in index.html's own order and ask what typeof window.px is.
   The second version then scanned pxF bodies for String(+n) and flagged all
   seven fixed files, because the fix's own comment NAMES String(+n) as the
   thing it replaced. Comments are stripped before that scan now.

   Run: node tests/test-gold-rendered-prices.mjs */
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
  return { out, live, failed, pxGlobal: typeof C.px === 'undefined' ? undefined : typeof C.px };
}


/* A price literal on a gold card: four or five figures before the point,
   which on XAUUSD is a gold price and not a percentage, a count or a sigma. */
const PRICE = /\b\d{4,5}\.\d+\b/g;
const decimalsOf = s => (s.split('.')[1] || '').length;

console.log('== the corpus is real: every gold tab scanned ==');
const FED = await sweep(false);
{
  ok(FED.failed.length === 0, `all ${SCRIPTS.length} of index.html's scripts ran`);
  ok(FED.live.length >= 14, `${FED.live.length} gold tabs were driven through their own scan control`);
  const withPrices = FED.live.filter(id => (FED.out[id].txt.match(PRICE) || []).length > 0);
  ok(withPrices.length >= 5,
     `${withPrices.length} of them printed gold-shaped prices at all (${withPrices.join(', ')}) — `
     + 'a rounding rule over a corpus with no prices in it would pass for the wrong reason');
}

console.log('\n== and every price they print is rounded like a price ==');
{
  const offenders = [];
  let total = 0;
  for (const id of FED.live){
    const found = FED.out[id].txt.match(PRICE) || [];
    total += found.length;
    const loose = [...new Set(found.filter(p => decimalsOf(p) > 2))];
    if (loose.length){
      const ctx = FED.out[id].txt.match(new RegExp('.{0,45}' + loose[0].replace('.', '\\.') + '.{0,45}'));
      offenders.push(`${id} :: ${loose.length} of them, e.g. ${loose.slice(0, 3).join(', ')}`
                     + (ctx ? `\n             ${ctx[0].trim()}` : ''));
    }
  }
  ok(total >= 40, `${total} gold-price literals across the family`);
  ok(offenders.length === 0,
     'none carries more than two decimals'
     + (offenders.length ? ('\n      ' + offenders.join('\n      ')) : ''));
  /* GOLD PINE by name, because it is the one this file was written for. */
  const gp = FED.out['goldpine'];
  ok(!!gp, 'GOLD PINE is in the sweep');
  const gpPrices = gp.txt.match(PRICE) || [];
  ok(gpPrices.length >= 6, `GOLD PINE printed ${gpPrices.length} prices`);
  ok(gpPrices.every(p => decimalsOf(p) <= 2),
     `and every one of them is at two decimals or fewer (${gpPrices.slice(0, 4).join(', ')})`);
  ok(/ENTRY \d{4}\.\d{2} · SL \d{4}\.\d{2} · T1 \d{4}\.\d{2}/.test(gp.txt),
     'including the ENTRY · SL · T1 line on the card that carries SEND TO TRADE PLAN');
}

console.log('\n== the branch that was supposed to round is dead, and that is why ==');
{
  /* Asked of the RUNNING app, not of a regex. A first version of this check
     scanned the source for `function px(` and flagged three files —
     contract-report.js, gold-seven-step.js, omnigold1.js — all of which
     define a px INSIDE an IIFE, where it is module-scoped and reaches no
     window. Loading all 201 scripts in index.html's own order and asking the
     context settles it in one line. */
  ok(typeof FED.pxGlobal === 'undefined',
     'after all ' + SCRIPTS.length + ' of index.html\'s scripts have run, window.px is '
     + (FED.pxGlobal === undefined ? 'undefined' : 'a ' + FED.pxGlobal)
     + " — so every `typeof W.px === 'function'` branch in the app is dead, and the fallback beneath it "
     + 'is the only path a price ever took');

  const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.js'));
  const raw = [];
  for (const f of files){
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = src.match(/function pxF\([^)]*\)\s*\{[\s\S]{0,900}?\n\}/);
    if (!m) continue;
    /* comments stripped first: the fix's own note NAMES String(+n) as what it
       replaced, and the first version of this check read that note as the bug
       still being there */
    const code = m[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    if (/String\(\+[a-z]\)/.test(code)) raw.push(f);
  }
  ok(raw.length === 0,
     'and no pxF in the repo falls back to String(+n) any more'
     + (raw.length ? ' — still raw in: ' + raw.join(', ') : ''));
}

console.log('\n== the eight files were fixed with one rule, not eight ==');
{
  const RULE = /a >= 1000 \? 2 : a >= 1 \? 4 : a >= 0\.01 \? 5 : a >= 0\.0001 \? 7 : 9/;
  const fixed = ['goldpine.js', 'pine.js', 'pinemsb.js', 'pineavwap.js',
                 'pineht.js', 'pinenw.js', 'pinerf.js', 'pinesmc.js'];
  for (const f of fixed)
    ok(RULE.test(fs.readFileSync(path.join(ROOT, f), 'utf8')),
       `${f} rounds by magnitude — the same ladder omniroute's fmtPx uses`);
  /* The ladder is not toFixed(2): a sub-cent alt on a PINE tab would be
     rounded to 0.00 by that, which is why the house rule is a ladder. */
  const px = v => { const a = Math.abs(v); return v.toFixed(a >= 1000 ? 2 : a >= 1 ? 4 : a >= 0.01 ? 5 : a >= 0.0001 ? 7 : 9); };
  ok(px(4050.620761151771) === '4050.62', 'gold at 4050.620761151771 reads 4050.62');
  ok(px(0.00001234567) === '0.000012346', 'and a sub-cent alt keeps its figures rather than reading 0.00');
  ok(px(1.23456789) === '1.2346' && px(0.0523456) === '0.05235', 'with the steps between behaving too');
}

console.log('\n' + passed + ' passed, 0 failed');
