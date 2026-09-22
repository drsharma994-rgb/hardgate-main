/* HARDGATE — the last two gold tabs are scanned by pressing their own button.

   Pack 841 mounted every gold tab cold. Pack 842 fed four of them and drove
   them through refresh. GOLD PRO and OMNIGOLD fell outside both: they scan on
   an explicit user action, and refresh repaints rather than rescans, so 842
   listed them as unscanned and left their coverage at mount level.

   The reason the harness could not press them was the harness, not the tabs.
   Its stub element answered every querySelector with a throwaway node and
   dropped every listener on the floor, so ui.btn was never the node the tab
   had wired. This file gives the stub the three things a press needs: a
   selector resolves to ONE stable node, addEventListener records, and click()
   fires what was recorded. Both tabs then run their real scan — the same
   runGoldPro and runScan a user reaches — off stubbed candles.

   What that produces, and what is asserted below: GOLD PRO prices a 1D/4H
   structure read, a macro ledger and an execution-levels panel; OMNIGOLD
   replays all 77 mechanics on both horizons and renders the pooled
   expectancy table, the coverage map, the settled-execution panel and both
   verdict panels. Nothing across either prints NaN, undefined or
   [object Object].

   WHAT THIS STILL DOES NOT COVER. The XM send path and the BACKTEST BOT are
   wired to their own buttons and are not pressed here — they POST, and the
   backtest replays the whole send path for a minute. The alert zones and the
   lane throttle are likewise untouched.

   And the count, now that pack 845 has taken it: index.html's GOLD nav group
   holds SIXTEEN tabs. This file presses two of them. Between this file and
   packs 840-842 the hand-written tables reach seven of the sixteen by id;
   test-gold-family-coverage reads the group out of index.html and holds the
   family rule against all of them, and fails if a table here ever names a tab
   the app does not have or leaves one that nothing sweeps.

   Run: node tests/test-gold-tabs-press.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
              'hg-forward.js', 'goldind.js', 'formation.js', 'plans.js', 'hg-gates.js',
              'hg-plan.js', 'omniroute.js', 'setup-ui.js', 'omnigold.js'];

/* ---------- a DOM you can actually press ---------- */
function makeDom(sink){
  const byKey = new Map();
  function node(key){
    if (byKey.has(key)) return byKey.get(key);
    const listeners = Object.create(null);
    const el = {
      _html: '', _key: key, style: {}, dataset: {}, children: [], disabled: false, checked: false,
      textContent: '', value: '', tagName: 'DIV',
      classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); },
                   toggle(c, on){ on ? this._s.add(c) : this._s.delete(c); },
                   contains(c){ return this._s.has(c); } },
      appendChild(c){ el.children.push(c); return c; }, removeChild(){}, remove(){},
      setAttribute(k, v){ el.dataset[k] = v; }, getAttribute(){ return null; },
      removeAttribute(){}, closest(){ return null; }, contains(){ return false; },
      addEventListener(t, f){ (listeners[t] || (listeners[t] = [])).push(f); },
      removeEventListener(t, f){ const a = listeners[t]; if (a){ const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } },
      dispatchEvent(ev){
        const a = listeners[(ev && ev.type) || 'click'] || [];
        let last;
        for (const f of a) last = f.call(el, ev || { type: 'click', target: el, preventDefault(){}, stopPropagation(){} });
        return last;
      },
      click(){ return el.dispatchEvent({ type: 'click', target: el, preventDefault(){}, stopPropagation(){} }); },
      focus(){}, blur(){}, scrollIntoView(){},
      querySelector(sel){ return node(key + ' ' + sel); }, querySelectorAll(){ return []; },
      insertAdjacentHTML(_, h){ sink.push(String(h)); },
      getBoundingClientRect(){ return { top: 0, left: 0, width: 100, height: 20, bottom: 20, right: 100 }; },
      _listeners: listeners
    };
    Object.defineProperty(el, 'innerHTML', {
      get(){ return el._html; }, set(v){ el._html = String(v); sink.push(String(v)); } });
    byKey.set(key, el);
    return el;
  }
  return node;
}

const T0 = 1700000000 - (1700000000 % 86400);
const TF = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 };
const BARS = 240;      /* deep enough for a 45-bar warm-up plus a real walk */
function bars(n, tfSec){
  let p = 4000, s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const o = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    o.push({ t: T0 + i * tfSec, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 900 + rnd() * 1200 });
  }
  return o;
}

function boot(file, sink, starve){
  const store = Object.create(null);
  const node = makeDom(sink);
  const doc = {
    createElement: t => { const n = node('new:' + t + ':' + Math.random()); n.tagName = String(t || 'div').toUpperCase(); return n; },
    createDocumentFragment: () => node('frag:' + Math.random()),
    getElementById: id => node('#' + id), querySelector: s => node('doc ' + s),
    querySelectorAll: () => [], head: node('head'), body: node('body'),
    documentElement: node('html'), addEventListener(){}, removeEventListener(){},
    hidden: false, visibilityState: 'visible'
  };
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat, parseInt,
    Number, String, Object, Array, JSON, Date, RegExp, Boolean, Set, Map, WeakMap, document: doc,
    setTimeout: (f, ms) => globalThis.setTimeout(f, Math.min(Number(ms) || 0, 5)),
    clearTimeout: h => globalThis.clearTimeout(h), setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: f => globalThis.setTimeout(f, 0), cancelAnimationFrame: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    Promise, Error, NaN, Infinity, encodeURIComponent, decodeURIComponent,
    performance: { now: () => Date.now() },
    localStorage: { getItem: k => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.location = { href: '', search: '', hash: '', protocol: 'https:', host: 'x' };
  ctx.navigator = { userAgent: 'node', onLine: true };
  ctx.fetch = () => Promise.resolve({ ok: true, status: 200,
    json: () => Promise.resolve({ ok: true, decision: 'HOLD', confidence: 0.5, rationale: 'stub', agents: [], asOf: T0 }),
    text: () => Promise.resolve('{}') });
  vm.createContext(ctx);
  for (const f of BASE.concat(file ? [file] : [])){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade */ }
  }
  const mk = (res, count) => starve ? [] : bars(Math.max(60, Math.min(BARS, count || 200)), TF[String(res)] || 3600);
  ctx.getXAUCandles    = async (res, count) => mk(res, count);
  ctx.getGoldCandles   = async (res, count) => (starve ? null : { rows: mk(res, count), source: 'gold-spot' });
  ctx.getXmGoldCandles = async (res, count) => (starve ? null : { rows: mk(res, count), source: 'xm-xauusd' });
  ctx.binanceKlines    = async (sym, res, count) => mk(res, count);
  ctx.dropForming = rows => rows;
  return { ctx, node };
}

const BAD = /\bNaN\b|\bundefined\b|\[object Object\]/;
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SEL = { goldpro: '[data-gp="run"]', omnigold: '#ogRun' };

async function press(name, file, starve){
  const sink = [];
  const { ctx, node } = boot(file, sink, starve);
  const tab = (ctx.HG_tabs || []).filter(t => t && t.id === name)[0];
  if (!tab) return { tab: null, sink };
  const root = node('root:' + name);
  let threw = null;
  try { tab.mount(root); } catch (e) { threw = 'mount: ' + e.message; }
  const mounted = sink.length;
  const btn = root.querySelector(SEL[name]);
  const wired = ((btn._listeners.click || []).length);
  const t0 = Date.now();
  try { const r = btn.click(); if (r && r.then) await r; } catch (e) { threw = (threw || '') + ' click: ' + e.message; }
  await sleep(120);
  return { tab, sink, mounted, btn, wired, threw, ms: Date.now() - t0,
           fresh: sink.slice(mounted).map(strip).join(' · ') };
}

console.log('== the harness can press, and would notice if it could not ==');
const pro = await press('goldpro', 'goldpro.js', false);
const omni = await press('omnigold', null, false);
{
  for (const [name, r] of [['GOLD PRO', pro], ['OMNIGOLD', omni]]){
    ok(!!r.tab, `${name} is registered`);
    ok(r.wired === 1, `${name}'s scan button carries exactly ${r.wired} click handler — the stub kept the wiring`);
    ok(r.btn.disabled === false, `and the tab did not disable it, so the press is a real press`);
    ok(!r.threw, `${name} scans without throwing` + (r.threw ? ' — ' + r.threw : ''));
    ok(r.sink.length > r.mounted,
       `and pressing produced ${r.sink.length - r.mounted} chunks mounting alone did not`);
  }
  /* The v841 lesson: a harness that quietly drives ONE tab several times
     reports a confident result about tabs it never touched. Two different
     tabs must not produce the same bytes. */
  ok(pro.fresh !== omni.fresh && pro.fresh.length > 200 && omni.fresh.length > 200,
     'the two tabs rendered different output, so this is two scans and not one tab counted twice');
}

console.log('\n== GOLD PRO priced its panels off the fed bars ==');
{
  const t = pro.fresh;
  ok(/STRUCTURE/.test(t) && /MACRO LEDGER/.test(t) && /EXECUTION LEVELS/.test(t),
     'all three panels rendered — structure, macro ledger, execution levels');
  ok(/EMA 50 \(1D\)/.test(t) && /EMA 200 \(1D\)/.test(t), 'with both daily EMAs computed');
  const px = t.match(/\d{4}\.\d{2}/g) || [];
  ok(px.length >= 3, `quoting ${px.length} real price levels (${px.slice(0, 3).join(', ')}) — arithmetic, not a template`);
  ok(/1D bars \d+/.test(t) && /4H bars \d+/.test(t),
     `and it says how many bars it read (${(t.match(/1D bars \d+/) || [])[0]}, ${(t.match(/4H bars \d+/) || [])[0]})`);
  ok(!BAD.test(t), 'and nothing in the scan printed NaN, undefined or [object Object]');
}

console.log('\n== OMNIGOLD ran both horizons and rendered what it measured ==');
{
  const t = omni.fresh;
  ok(/measured on this horizon/.test(t), 'the pooled expectancy table rendered');
  ok(/SCALP \(1h/.test(t) && /SWING \(4h/.test(t),
     'for BOTH horizons — the 1h scalp walk and the 4h swing walk each completed');
  ok(/MECHANIC/.test(t) && /T1-FIRST/.test(t) && /EXPECTANCY/.test(t),
     'with its mechanic, hit-rate and expectancy columns');
  for (const m of ['SPRING', 'PO3', 'ORB', 'VALUE', 'KZ-JUDAS', 'ROUND-MAGNET'])
    ok(t.indexOf(m) >= 0, `and a row for ${m}`);
  ok(/all 78 mechanics/.test(t),
     'the coverage map states the full roster, so no mechanic was skipped to make the scan finish');
  ok(/SCALP VERDICT/.test(t) && /DESK VERDICT/.test(t), 'both verdict panels rendered');
  ok(/PROVEN EDGE/.test(t), 'and the settled-execution panel');
  const sig = t.match(/[-+]\d+\.\d\dσ/g) || [];
  ok(sig.length >= 6, `${sig.length} sigma readings came out of the walk (${sig.slice(0, 3).join(', ')})`);
  ok(!BAD.test(t), 'and nothing across the whole scan printed NaN, undefined or [object Object]');
  ok(omni.ms < 60000, `the scan finished in ${(omni.ms / 1000).toFixed(1)}s on ${BARS} bars`);
}

console.log('\n== the feed is load-bearing on both, and starved they say so ==');
{
  const pro0 = await press('goldpro', 'goldpro.js', true);
  const omni0 = await press('omnigold', null, true);
  ok(!pro0.threw && !omni0.threw, 'neither tab throws when every candle source returns nothing');
  ok(!/EMA 50 \(1D\)/.test(pro0.fresh),
     'a starved GOLD PRO computes no daily EMA, so the numbers above came from the bars and not a template');
  ok(!/measured on this horizon/.test(omni0.fresh),
     'and a starved OMNIGOLD publishes no expectancy table rather than one measured on nothing');
  ok(!BAD.test(pro0.fresh) && !BAD.test(omni0.fresh),
     'and a starved scan still prints no NaN, undefined or [object Object] on either tab');
}

console.log('\n== and the whole rendered surface is swept, not a sample ==');
{
  let chunks = 0;
  const offenders = [];
  for (const [name, r] of [['goldpro', pro], ['omnigold', omni]]){
    for (const h of r.sink){
      chunks++;
      const s = strip(h);
      if (!BAD.test(s)) continue;
      const m = s.match(/.{0,55}(NaN|undefined|\[object Object\]).{0,45}/);
      offenders.push(name + ' :: ' + (m ? m[0] : s.slice(0, 90)));
    }
  }
  ok(chunks >= 18, `${chunks} rendered chunks across the two button-driven tabs`);
  ok(offenders.length === 0,
     'none of them printed a number the tab does not have'
     + (offenders.length ? ('\n      ' + offenders.slice(0, 5).join('\n      ')) : ''));
}

console.log('\n' + passed + ' passed, 0 failed');
