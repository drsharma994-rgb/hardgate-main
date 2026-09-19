/* HARDGATE — no gold tab hands over a setup that risks more than it can make.

   Pack 847 started reading what the gold family actually renders and found a
   formatting defect. Reading the same corpus for GEOMETRY found a worse one.
   Every ENTRY/STOP/T1 triple the family prints is coherent — stop and target
   on the correct sides of entry, twelve for twelve — but one card was this:

     XAUUSD SHORT · #1 PICK · PRIMARY · SOLIDITY GOOD
     ENTRY 4050.62 · SL 4069.90 · T1 4045.59        R:R 0.26
     [SEND TO TRADE PLAN →]  [ADD TO BOOK]

   19.28 points of risk for 5.03 of reward, on a GOLD PINE card offering both
   handoff buttons.

   Every other gold desk refuses this. GOLD SCALP floors at
   HG_GOLD_SCALP_MIN_RR, GOLD SWING at HG_GOLD_SWING_MIN_RR, and the shared
   plan layer states the rule outright: a structural target below the floor
   REJECTS rather than pushing T1 out to meet it. GOLD PINE had no reward test
   anywhere in its path — it drew the buttons on every card it drew.

   SOLIDITY did not miss it, and that is worth being precise about, because
   "SOLIDITY GOOD" on a 0.26 R:R card looks like a lie and is not one. The
   grade is a score out of seven gates, R:R is one of them, and a card can
   fail that one and still reach five. A summary out of seven is not a floor.
   This tab had no floor.

   The fix keeps the card — the levels are worth reading, and the sibling
   desks keep demoted cards visible too — and replaces the two buttons with a
   line naming the number, the floor and the shortfall. A setup whose reward
   cannot be measured at all is left alone: unmeasured is not a failing grade
   anywhere else on this desk and it is not one here.

   THE RULE BELOW IS NON-VACUOUS, and that is checked rather than hoped: it is
   run against the corpus this family renders, which must contain both a
   blocked card and a live handoff for the run to count. Against the corpus
   from before the fix it finds the two offenders; against the corpus after
   it, none.

   Run: node tests/test-gold-handoff-floor.mjs */
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
  return { out, live, failed,
           scalpFloor: +C.HG_GOLD_SCALP_MIN_RR, swingFloor: +C.HG_GOLD_SWING_MIN_RR,
           pxGlobal: typeof C.px === 'undefined' ? undefined : typeof C.px };
}



const HANDOFF = /SEND TO TRADE PLAN/g;
const BLOCKED = /NO TRADE HANDOFF/g;

/* The R:R that belongs to a handoff button is the last one printed before it.
   Splitting the flattened text into cards is unreliable; looking backwards a
   bounded distance from the button is not. */
function rrBehind(txt, at){
  const back = txt.slice(Math.max(0, at - 700), at);
  const rrs = [...back.matchAll(/R:R\s+([\d.]+)/g)];
  return rrs.length ? parseFloat(rrs[rrs.length - 1][1]) : NaN;
}

console.log('== the house floors exist, and this tab reads them ==');
const FED = await sweep(false);
{
  ok(FED.failed.length === 0, `all ${SCRIPTS.length} of index.html's scripts ran`);
  ok(FED.live.length >= 14, `${FED.live.length} gold tabs were driven through their own scan control`);
  ok(isFinite(FED.scalpFloor) && FED.scalpFloor > 0,
     `HG_GOLD_SCALP_MIN_RR is on the window at ${FED.scalpFloor}`);
  ok(isFinite(FED.swingFloor) && FED.swingFloor > 0,
     `HG_GOLD_SWING_MIN_RR is on the window at ${FED.swingFloor}`);
  const gp = fs.readFileSync(path.join(ROOT, 'goldpine.js'), 'utf8');
  ok(/W\.HG_GOLD_SCALP_MIN_RR/.test(gp) && /W\.HG_GOLD_SWING_MIN_RR/.test(gp),
     'and goldpine.js reads both off the window rather than carrying its own copy to drift');
}

console.log('\n== the corpus can actually answer the question ==');
{
  const all = FED.live.map(id => FED.out[id].txt).join(' ');
  const handoffs = (all.match(HANDOFF) || []).length;
  const blocks = (all.match(BLOCKED) || []).length;
  ok(handoffs > 0, `${handoffs} handoff buttons across the family — a rule over a corpus with none would pass for nothing`);
  ok(blocks > 0, `${blocks} cards had their handoff withheld, so the floor is biting and not merely present`);
}

console.log('\n== and none of those buttons sits on a setup that risks more than it makes ==');
{
  const offenders = [];
  let checked = 0, withRr = 0;
  for (const id of FED.live){
    const txt = FED.out[id].txt;
    let m; HANDOFF.lastIndex = 0;
    while ((m = HANDOFF.exec(txt))){
      checked++;
      const rr = rrBehind(txt, m.index);
      if (!isFinite(rr)) continue;       /* unmeasured is not a veto, here either */
      withRr++;
      if (rr < 1){
        const ctx = txt.slice(Math.max(0, m.index - 150), m.index).replace(/\s+/g, ' ').trim();
        offenders.push(`${id} :: R:R ${rr} — …${ctx.slice(-110)}`);
      }
    }
  }
  ok(checked > 0 && withRr > 0, `${checked} handoff buttons, ${withRr} of them with a printed R:R to judge`);
  ok(offenders.length === 0,
     'every handoff the gold family offers is on a setup whose target is at least as far as its stop'
     + (offenders.length ? ('\n      ' + offenders.join('\n      ')) : ''));
}

console.log('\n== GOLD PINE, which is the tab this was found on ==');
{
  const gp = FED.out['goldpine'];
  ok(!!gp, 'GOLD PINE is in the sweep');
  const txt = gp.txt;
  ok(/NO TRADE HANDOFF — R:R \d\.\d\d is below this desk’s \d\.\d\d floor for (SWING|SCALP)/.test(txt),
     'a card below the floor says so, naming its R:R, the floor and the horizon');
  ok(/the target is nearer than the stop/.test(txt),
     'and when the reward is under 1R it says that in words, not only in a ratio');
  ok(/The levels are shown to be read, not sent\./.test(txt),
     'while keeping the card, because the levels are still worth reading');
  /* The block must be surgical: a card that clears the floor keeps both. */
  let m; HANDOFF.lastIndex = 0;
  const kept = [];
  while ((m = HANDOFF.exec(txt))) kept.push(rrBehind(txt, m.index));
  ok(kept.length > 0, `${kept.length} GOLD PINE cards still carry the handoff`);
  ok(kept.every(rr => !isFinite(rr) || rr >= FED.swingFloor || rr >= FED.scalpFloor),
     `and every one of them clears a house floor (${kept.filter(isFinite).map(r => r.toFixed(2)).join(', ')})`);
  ok(!/NO TRADE HANDOFF[^<]{0,200}SEND TO TRADE PLAN/.test(txt),
     'no card both withholds the handoff and offers it');
}

console.log('\n== and the geometry the family prints is coherent ==');
{
  /* The sweep that found the R:R card in the first place. The first version
     asked only that stop and target sit on OPPOSITE sides of entry, and a
     mutation that swapped the two on a short card sailed through it: swapped,
     the levels are still opposite, they just read as a long. So the direction
     the card PRINTS decides which side each belongs on. */
  const RX = /ENTRY\s+\$?([\d,]+\.\d+)\s*[·|,]?\s*(?:STOP|SL)\s+\$?([\d,]+\.\d+)\s*[·|,]?\s*(?:T1|TP1)\s+\$?([\d,]+\.?\d*)/g;
  const num = s => parseFloat(String(s).replace(/[$,]/g, ''));
  const bad = [];
  let triples = 0, withDir = 0, unstated = 0;
  for (const id of FED.live){
    let m; RX.lastIndex = 0;
    while ((m = RX.exec(FED.out[id].txt))){
      triples++;
      const e = num(m[1]), s = num(m[2]), t = num(m[3]);
      if (!(e > 0 && s > 0 && t > 0)) { bad.push(`${id} :: a level at zero — ${m[0]}`); continue; }
      if (e === s) { bad.push(`${id} :: entry equals stop, zero risk — ${m[0]}`); continue; }
      if (!((s < e && t > e) || (s > e && t < e))){ bad.push(`${id} :: ${m[0]}`); continue; }
      /* the direction this card states, taken from the nearest one before it */
      const back = FED.out[id].txt.slice(Math.max(0, m.index - 600), m.index);
      const dirs = [...back.matchAll(/\b(LONG|SHORT)\b/g)];
      if (!dirs.length) { unstated++; continue; }
      const dir = dirs[dirs.length - 1][1];
      const shaped = (dir === 'LONG') ? (s < e && t > e) : (s > e && t < e);
      withDir++;
      if (!shaped) bad.push(`${id} :: card says ${dir} but prints ${m[0]}`);
    }
  }
  ok(triples >= 8, `${triples} ENTRY/STOP/T1 triples across the family`);
  ok(withDir >= 8,
     `${withDir} of them state a direction near the levels, so the rule has a side to check against`
     + (unstated ? ` (${unstated} stated none and were skipped)` : ''));
  ok(bad.length === 0,
     'each puts its stop and its target where the direction it prints says they belong, and none risks nothing'
     + (bad.length ? ('\n      ' + bad.join('\n      ')) : ''));
}

console.log('\n' + passed + ' passed, 0 failed');
