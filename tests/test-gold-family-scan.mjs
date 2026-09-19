/* HARDGATE — every gold tab is scanned through its own control, and the bars
   are shown to be load-bearing.

   Pack 845 held the family rule against index.html's GOLD nav group and
   reported all fifteen registered gold tabs mounting and refreshing clean.
   That green was weaker than it read. Driving the same fifteen against a
   STARVED feed and diffing the output showed six of them rendering byte-for-
   byte what they rendered fed: for those six the bars never arrived, so the
   sweep was measuring a repaint and not any arithmetic.

   The reason is that most of this family scans on an explicit action. So this
   file finds that action instead of being told it. It enumerates the click
   handlers each tab actually wired onto its own DOM and presses the one whose
   selector reads like a scan — no table of selectors to drift, the same
   reason pack 845 reads the nav group instead of copying it.

   GOLD DIRECTION is why a single press is not enough. Its CONFIRM & SCAN
   button ships DISABLED until a side is armed, so a one-shot harness only
   ever reaches the LONG/SHORT toggles and never scans the tab at all — it
   read as "the feed does not matter here" when the truth was "this harness
   never got as far as the feed". Arming first takes it from 6,657 characters
   to 20,831. That two-step is asserted by name below.

   Twelve of the fifteen now prove the candle feed is load-bearing: starve it
   and the output changes. Three do not, and each has a checked reason rather
   than a shrug — they do not read candles at all:

     super-gold  reads __hgSuperGoldSnap, other desks' published snapshots
     goldspot    goes to /api/proxy for a spot print; no candle fetcher in it
     tauric      is the /api/tauric agent pipeline

   And the instrument is checked before it is trusted. Two identical fed runs
   go first: whatever moves between THEM is this harness's own variance, and a
   starved difference has to beat it to mean anything. One tab (OPTIGOLD) does
   print something different between identical runs — a clock — but no tab's
   LENGTH moves at all, so the floor is 50 characters and the smallest real
   starved drop clears it by more than twice that. Without that control,
   "it rendered differently" is a claim about the run and not about the bars.

   Pressing everything in rounds, which was the first design, exhausted an
   8GB heap: a press can re-render, each re-render re-queries, and the scans
   re-enter. It is bounded to one arming step and one scan.

   Run: node tests/test-gold-family-scan.mjs */
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
  return { out, live, failed };
}

console.log('== the app comes up, and the group is the app’s own ==');
const FED = await sweep(false);
{
  ok(GOLD.length >= 12, `index.html's GOLD nav group names ${GOLD.length} tabs`);
  ok(FED.failed.length === 0, `all ${SCRIPTS.length} of index.html's scripts ran`);
  ok(FED.live.length >= 14, `${FED.live.length} of them register a tab this harness can drive`);
}

console.log('\n== every one of them has a scan control, and it was found not told ==');
{
  const lost = FED.live.filter(id => !FED.out[id].found);
  ok(lost.length === 0,
     `a scan control was discovered on all ${FED.live.length} gold tabs by reading the click handlers they wired`
     + (lost.length ? ' — none found on: ' + lost.join(', ') : ''));
  const names = FED.live.map(id => (FED.out[id].pressed.filter(p => p.indexOf('scan:') === 0)[0] || '').slice(5));
  ok(names.every(n => n.length > 0), `and pressed: ${names.join(' ')}`);
  ok(new Set(names).size >= FED.live.length - 1,
     'and they are distinct controls, not one shared button pressed fifteen times');
  const grew = FED.live.filter(id => FED.out[id].txt.length > FED.out[id].afterRefresh.length);
  ok(grew.length >= 12,
     `${grew.length} of ${FED.live.length} rendered MORE after the press than refresh alone had — the press is doing work`);
}

console.log('\n== GOLD DIRECTION needs two steps, and that is why one press was not enough ==');
{
  const gd = FED.out['golddirection'];
  ok(!!gd, 'GOLD DIRECTION is in the sweep');
  ok(gd.scanAtMount === false,
     'its scan control is DISABLED at mount — CONFIRM & SCAN ships greyed out until a side is armed');
  ok(gd.armed === true && gd.pressed.some(p => p.indexOf('arm:') === 0),
     `so the harness armed a side first (${gd.pressed.filter(p => p.indexOf('arm:') === 0).join(', ')})`);
  ok(gd.pressed.some(p => p.indexOf('scan:') === 0),
     `and only then could press ${gd.pressed.filter(p => p.indexOf('scan:') === 0)[0]}`);
  ok(gd.txt.length > gd.afterRefresh.length + 1500,
     `which took it from ${gd.afterRefresh.length} characters to ${gd.txt.length} — a one-press harness saw none of that`);
  /* Every other tab's scan control IS live at mount, so the two-step is a
     property of this tab and not of the harness. */
  const oneStep = FED.live.filter(id => FED.out[id].scanAtMount);
  ok(oneStep.length === FED.live.length - 1,
     `the other ${oneStep.length} tabs expose their scan control immediately, so this is GOLD DIRECTION's design, not the harness's`);
}

console.log('\n== the instrument is checked before it is trusted ==');
const FED2 = await sweep(false);
let noiseFloor = 0;
{
  /* Two identical fed runs. Whatever moves between THEM is this harness's own
     variance — a clock, an ordering — and a starved difference has to beat it
     to mean anything. Without this control, "it rendered differently" is a
     claim about the run and not about the bars. */
  const noisy = FED.live.filter(id => FED2.out[id].txt !== FED.out[id].txt);
  const spread = FED.live.map(id => Math.abs(FED2.out[id].txt.length - FED.out[id].txt.length));
  noiseFloor = Math.max(50, ...spread);
  ok(FED2.live.length === FED.live.length, `a second identical fed run drove the same ${FED2.live.length} tabs`);
  ok(noisy.length <= 2,
     `${noisy.length} of them render anything different between two identical runs`
     + (noisy.length ? ` (${noisy.join(', ')} — a clock in the text)` : ''));
  ok(noiseFloor <= 200,
     `and no tab's LENGTH moved by more than ${Math.max(...spread)} characters, so the floor a starved `
     + `difference must clear is ${noiseFloor}`);
}

console.log('\n== starve the bars and the numbers go with them ==');
const STARVED = await sweep(true);
{
  /* Each one's reason is READ OUT OF ITS FILE, not asserted from memory. */
  const NO_CANDLES = {
    'super-gold': { file: 'super-gold.js', mark: /__hgSuperGoldSnap/, why: "other desks' published snapshots" },
    goldspot:     { file: 'goldspot.js',   mark: /[/]api[/]proxy/,    why: 'a proxied spot print' },
    tauric:       { file: 'tauric.js',     mark: /api[/]tauric/,      why: 'the TradingAgents pipeline' }
  };
  const bearing = [], flat = [];
  for (const id of FED.live){
    const d = Math.abs(FED.out[id].txt.length - STARVED.out[id].txt.length);
    (d > noiseFloor ? bearing : flat).push(id + (d ? '' : ''));
  }
  ok(bearing.length >= 12,
     `${bearing.length} of ${FED.live.length} gold tabs shrink by more than the ${noiseFloor}-character noise floor `
     + 'when the bars are taken away, so their numbers came from the bars');
  ok(flat.every(id => Object.prototype.hasOwnProperty.call(NO_CANDLES, id)),
     'and every tab that did not move is one that does not read candles: ' + flat.join(', '));
  ok(flat.length === Object.keys(NO_CANDLES).length,
     `all ${flat.length} of them, so the exception list is exactly the set observed and not a longer one written in advance`);
  for (const [id, spec] of Object.entries(NO_CANDLES)){
    if (FED.live.indexOf(id) < 0) continue;
    ok(spec.mark.test(fs.readFileSync(path.join(ROOT, spec.file), 'utf8')),
       `${id} reads ${spec.why} — checked in ${spec.file}, not asserted from memory`);
  }
  ok(!/getXAUCandles|getGoldCandles|getXmGoldCandles|binanceKlines/.test(fs.readFileSync(path.join(ROOT, 'goldspot.js'), 'utf8')),
     'and goldspot reaches for no candle fetcher at all, which is why starving them cannot move it');
}

console.log('\n== nothing either run printed is a number the tab does not have ==');
{
  const offenders = [];
  let chunks = 0, chars = 0;
  for (const [label, S] of [['fed', FED], ['starved', STARVED]]){
    for (const id of S.live){
      const r = S.out[id];
      chars += r.txt.length;
      if (r.threw) offenders.push(`${label} ${id} THREW :: ${r.threw}`);
      const s = r.txt;
      if (!BAD.test(s)) continue;
      const m = s.match(/.{0,55}(NaN|undefined|\[object Object\]).{0,45}/);
      offenders.push(`${label} ${id} :: ${m ? m[0] : s.slice(0, 90)}`);
    }
  }
  ok(chars > 250000, `${chars.toLocaleString()} characters of rendered text across both runs`);
  ok(offenders.length === 0,
     'no gold tab threw, and none printed NaN, undefined or [object Object] — fed or starved'
     + (offenders.length ? ('\n      ' + offenders.slice(0, 8).join('\n      ')) : ''));
}

console.log('\n' + passed + ' passed, 0 failed');
