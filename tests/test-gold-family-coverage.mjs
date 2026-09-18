/* HARDGATE — the gold family rule is checked against the app's own list of gold tabs.

   Packs 840-842 shipped three cross-cutting sweeps — mount every gold tab,
   drive every gold tab through refresh, press the two that scan on a button —
   and each carried a hand-written table of tab ids. The tables held six:
   goldscalp, goldswing, goldpro, omnigold, tauric, 80percent.

   index.html's GOLD nav group holds SIXTEEN.

     super-gold  omnigold  omnigold1  optigold  newgold  golddirection
     goldswing   goldscalp goldultra  gold      goldpro  goldspot
     goldcoint   goldpine  tauric     80percent

   Every one of those has its own behavioural tests — that is not the gap. The
   gap is that a file titled "the render-integrity rule now runs across every
   gold tab" ran it across six of them, and nothing would have said so. A
   hand-written table cannot notice a tab it was never told about; that is the
   vacuous-sweep problem those very files were written to avoid, in the files
   that were written to avoid it.

   So this one does not carry a table. It reads the GOLD nav group out of
   index.html, loads every script index.html loads, and holds the family rule
   against whatever the group says is in the family:

     - every id in the group is accounted for
     - every registered gold tab mounts and refreshes without throwing
     - nothing any of them renders prints NaN, undefined or [object Object]

   And it guards the drift: the older tables must be a SUBSET of the group (no
   phantom ids), and anything in the group they miss must be covered here. Add
   a seventeenth gold tab and this file fails until it is in the sweep.

   Run: node tests/test-gold-family-coverage.mjs */
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
      querySelector(s){ return node(key + ' ' + s); }, querySelectorAll(){ return []; },
      insertAdjacentHTML(_, h){ sink.push(String(h)); },
      getBoundingClientRect(){ return { top: 0, left: 0, width: 100, height: 20, bottom: 20, right: 100 }; },
      _listeners: L
    };
    Object.defineProperty(el, 'innerHTML', {
      get(){ return el._html; }, set(v){ el._html = String(v); sink.push(String(v)); } });
    byKey.set(key, el);
    return el;
  }
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

const sharedSink = [];
function boot(){
  const node = makeDom(sharedSink);
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
  /* THE FEED — every fetcher the gold family reaches for. */
  const mk = (res, count) => bars(Math.max(60, Math.min(220, count || 200)), TFS[String(res)] || 3600);
  ctx.getXAUCandles    = async (r, c) => mk(r, c);
  ctx.getGoldCandles   = async (r, c) => ({ rows: mk(r, c), source: 'gold-spot' });
  ctx.getXmGoldCandles = async (r, c) => ({ rows: mk(r, c), source: 'xm-xauusd' });
  ctx.binanceKlines    = async (s, r, c) => mk(r, c);
  ctx.dropForming      = r => r;
  return { ctx, node, loaded, failed };
}

const BAD = /\bNaN\b|\bundefined\b|\[object Object\]/;
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log('== the list comes from the app, not from this file ==');
const { ctx: C, loaded, failed } = boot();
{
  ok(GOLD.length >= 12, `index.html's GOLD nav group names ${GOLD.length} tabs`);
  ok(GOLD.indexOf('omnigold') >= 0 && GOLD.indexOf('goldscalp') >= 0 && GOLD.indexOf('goldultra') >= 0,
     'and it is the real group — omnigold, goldscalp and goldultra are all in it');
  ok(SCRIPTS.length > 150, `index.html loads ${SCRIPTS.length} scripts, and this harness loads them in the same order`);
  ok(failed.length === 0, `all ${loaded.length} of them ran` + (failed.length ? (': ' + failed.slice(0, 3).join(' | ')) : ''));
  ok((C.HG_tabs || []).length > 40, `${(C.HG_tabs || []).length} tabs registered — the whole app came up, not a gold slice of it`);
}

console.log('\n== every id in the group is accounted for ==');
const reg = new Map((C.HG_tabs || []).filter(t => t && t.id).map(t => [t.id, t]));
const live = [];
{
  const orphans = [];
  for (const id of GOLD){
    if (reg.has(id)){ live.push(id); continue; }
    if (Object.prototype.hasOwnProperty.call(INLINE, id)) continue;
    orphans.push(id);
  }
  ok(orphans.length === 0,
     `every gold tab either registers on HG_tabs (${live.length}) or is a named inline pane (${Object.keys(INLINE).length})`
     + (orphans.length ? ' — unaccounted: ' + orphans.join(', ') : ''));
  for (const [id, why] of Object.entries(INLINE))
    ok(new RegExp('id="tab_' + id + '"').test(INDEX) && new RegExp('id="tabB_' + id + '"').test(INDEX),
       `${id} really is that inline pane — index.html has its own section and nav button (${why})`);
  ok(live.length + Object.keys(INLINE).length === GOLD.length,
     `${live.length} + ${Object.keys(INLINE).length} = ${GOLD.length}, the whole group, nothing dropped to make the sum work`);
}

console.log('\n== every one of them mounts and refreshes ==');
const results = [];
{
  for (const id of live){
    const tab = reg.get(id);
    const sink = [];
    const node = makeDom(sink);
    let threw = null;
    try { tab.mount(node('root:' + id)); } catch (e) { threw = 'mount: ' + e.message.slice(0, 90); }
    const mounted = sink.length;
    try { const r = tab.refresh && tab.refresh(); if (r && r.then) await Promise.race([r, sleep(20000)]); }
    catch (e) { threw = (threw ? threw + ' | ' : '') + 'refresh: ' + e.message.slice(0, 90); }
    await sleep(120);
    results.push({ id, threw, sink, fresh: sink.length - mounted, txt: sink.map(strip).join(' · ') });
  }
  /* The claim below is built from what was actually driven, not from what was
     registered. A first version of this file read the registration list here,
     and a mutation that quietly dropped goldultra from the loop still passed —
     the sweep's own coverage has to be evidence, not assumption. */
  ok(results.length === live.length,
     `${results.length} tabs driven, and ${live.length} were registered — the loop skipped none of them`);
  const broke = results.filter(r => r.threw);
  ok(broke.length === 0,
     `all ${results.length} registered gold tabs mount and refresh without throwing`
     + (broke.length ? ('\n      ' + broke.map(r => r.id + ' :: ' + r.threw).join('\n      ')) : ''));
  const silent = results.filter(r => r.sink.length === 0);
  ok(silent.length === 0,
     'and every one of them rendered something — a tab that paints nothing at all is not passing, it is absent'
     + (silent.length ? (': ' + silent.map(r => r.id).join(', ')) : ''));
  const scanned = results.filter(r => r.fresh > 0).length;
  ok(scanned >= 8,
     `${scanned} of them produced output on refresh that mounting alone did not, so the feed is reaching real work`);
}

console.log('\n== and the family rule holds across all of them ==');
{
  const offenders = [];
  let chunks = 0, chars = 0;
  for (const r of results){
    chunks += r.sink.length;
    chars += r.txt.length;
    for (const h of r.sink){
      const s = strip(h);
      if (!BAD.test(s)) continue;
      const m = s.match(/.{0,55}(NaN|undefined|\[object Object\]).{0,45}/);
      if (!offenders.some(o => o.indexOf(r.id + ' ::') === 0))
        offenders.push(r.id + ' :: ' + (m ? m[0] : s.slice(0, 90)));
    }
  }
  ok(chunks >= 40, `${chunks} rendered chunks across ${results.length} gold tabs`);
  ok(chars > 100000, `${chars.toLocaleString()} characters of rendered text — a real surface, not a handful of shells`);
  ok(offenders.length === 0,
     'none of it printed NaN, undefined or [object Object]'
     + (offenders.length ? ('\n      ' + offenders.slice(0, 6).join('\n      ')) : ''));
}

const SWEPT = new Set(results.map(r => r.id));

console.log('\n== the older tables cannot drift away from the group ==');
{
  /* Packs 840-844 each carry a hand-written table. They are allowed to cover a
     subset — that is what they were written for — but they may not name
     something the app does not have, and nothing they leave out may be left
     out here.

     Two kinds of key live in those tables and the first run of this guard
     conflated them: 840 sweeps MODULE exports and keys by file basename
     (eightypercent), while 841/842/844 key by TAB id (80percent). A key is
     legitimate if it is a gold tab id OR a script index.html actually loads. */
  const files = ['test-gold-render-integrity.mjs', 'test-gold-tabs-mount.mjs',
                 'test-gold-tabs-scan.mjs', 'test-gold-tabs-press.mjs'];
  const named = new Set();
  for (const f of files){
    const src = fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8');
    const block = src.match(/const (?:TABS|SCANS|UNSCANNED|SEL)\s*=\s*\{[\s\S]*?\};/g) || [];
    ok(block.length > 0, `${f} carries a hand-written tab table`);
    /* KEYS only. Matching `id:` anywhere caught 'eightypercent.js' out of a
       VALUE on the first run and reported the phantom it was written to
       find — so the key must follow a brace or a comma. */
    for (const b of block)
      for (const m of b.matchAll(/[{,]\s*'?([a-z0-9][a-z0-9-]*)'?\s*:/g)) named.add(m[1]);
  }
  const isScript = k => SCRIPTS.indexOf(k + '.js') >= 0;
  const phantom = [...named].filter(id => GOLD.indexOf(id) < 0 && !isScript(id));
  ok(phantom.length === 0,
     `the four tables between them name ${named.size} entries, and every one is a gold tab id or a script index.html loads`
     + (phantom.length ? ' — neither: ' + phantom.join(', ') : ''));
  const uncovered = GOLD.filter(id => !named.has(id)
                                   && !SWEPT.has(id)
                                   && !Object.prototype.hasOwnProperty.call(INLINE, id));
  ok(uncovered.length === 0,
     'and every gold tab those tables leave out is swept above — add a seventeenth and this fails until it is'
     + (uncovered.length ? ': ' + uncovered.join(', ') : ''));
  const inTables = GOLD.filter(id => named.has(id));
  ok(inTables.length < GOLD.length,
     `those tables name ${inTables.length} of the ${GOLD.length} gold tabs by id; the other `
     + `${GOLD.length - inTables.length} reach the family rule only through this file, which is why it reads `
     + 'the group instead of copying it');
  ok(GOLD.filter(id => !named.has(id)).every(id => SWEPT.has(id) || id in INLINE),
     'and every one of those is swept above or named as the inline pane — none is simply unmentioned: '
     + GOLD.filter(id => !named.has(id)).join(', '));
}

console.log('\n' + passed + ' passed, 0 failed');
