/* HARDGATE — the gold tabs are clean through a real scan, not only cold.

   Pack 841 mounted every gold tab and swept its shell. That proved the cold
   state, which is a narrow claim: a tab renders its empty copy before it has
   any data, and the interesting arithmetic has not run yet.

   This file feeds them. Every bar fetcher the gold family reaches for —
   getGoldCandles, getXAUCandles, getXmGoldCandles, binanceKlines,
   hgOgFetchRows — is stubbed with real synthetic candles, and the tabs are
   driven through their own refresh. Four of them scan, price setups and
   render cards from those bars:

     GOLD SWING   "BINANCE PAXGUSDT SHORT · GRADE C S52 RANGE-BAR S0 SWEEP ·
                   ATR14 4h 15.4722 · R:R 1 : 2.1 (T1)"
     GOLD SCALP   the weekend-exposure ledger and the killzone silence note
     TAURIC       its agent-availability panel
     80PERCENT    the ladder view

   WHAT THIS DOES NOT COVER, so the green is not read as more than it is:
   GOLD PRO and OMNIGOLD scan on an explicit user action rather than on
   refresh, so they produce no new output HERE and are listed below as
   unscanned rather than quietly dropped from the table. Their scans are
   covered by test-gold-tabs-press, which gives the stub element a working
   addEventListener and click() and presses their buttons. The assertions
   below still hold as written: what they pin is that refresh does not rescan
   these two, which is why that file exists.

   Run: node tests/test-gold-tabs-scan.mjs */
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
const SCANS = { goldscalp: 'goldscalp.js', goldswing: 'goldswing.js',
                tauric: 'tauric.js', '80percent': 'eightypercent.js' };
const UNSCANNED = { goldpro: 'goldpro.js', omnigold: null };

function makeEl(sink){
  const el = { _html: '', style: {}, dataset: {}, classList: { add(){}, remove(){}, contains: () => false },
               children: [], appendChild(c){ el.children.push(c); return c; }, removeChild(){}, remove(){},
               setAttribute(){}, getAttribute: () => null, addEventListener(){}, removeEventListener(){},
               querySelector: () => makeEl(sink), querySelectorAll: () => [],
               insertAdjacentHTML(_, h){ sink.push(String(h)); },
               focus(){}, click(){}, textContent: '', value: '' };
  Object.defineProperty(el, 'innerHTML', {
    get(){ return el._html; }, set(v){ el._html = String(v); sink.push(String(v)); } });
  return el;
}
const T0 = 1700000000 - (1700000000 % 86400);
const TF = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 };
function bars(n, tfSec, seed){
  let p = 4000, s = seed || 3;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const o = [];
  for (let i = 0; i < n; i++){
    p = p * (1 + (rnd() - 0.48) * 0.004);
    const r = p * 0.002 * (0.5 + rnd());
    o.push({ t: T0 + i * tfSec, o: p - r * 0.25, h: p + r, l: p - r, c: p, v: 900 + rnd() * 1200 });
  }
  return o;
}
function boot(file, sink){
  const store = Object.create(null);
  const doc = { createElement: () => makeEl(sink), createDocumentFragment: () => makeEl(sink),
                getElementById: () => makeEl(sink), querySelector: () => makeEl(sink),
                querySelectorAll: () => [], head: makeEl(sink), body: makeEl(sink),
                documentElement: makeEl(sink), addEventListener(){}, removeEventListener(){} };
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date, RegExp, document: doc,
                setTimeout: (f) => { try { f && f(); } catch (e) {} return 0; }, clearTimeout: () => {},
                setInterval: () => 0, clearInterval: () => {},
                requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
                addEventListener: () => {}, removeEventListener: () => {},
                Promise, Error, NaN, Infinity, encodeURIComponent, decodeURIComponent,
                localStorage: { getItem: k => (k in store ? store[k] : null),
                                setItem: (k, v) => { store[k] = String(v); },
                                removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.location = { href: '', search: '', hash: '' };
  ctx.navigator = { userAgent: 'node', onLine: true };
  ctx.fetch = () => Promise.resolve({ ok: true, status: 200,
    json: () => Promise.resolve({ ok: true, decision: 'HOLD', confidence: 0.5,
                                  rationale: 'stub', agents: [], asOf: T0 }),
    text: () => Promise.resolve('{}') });
  vm.createContext(ctx);
  for (const f of BASE.concat(file ? [file] : [])){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade */ }
  }
  /* THE FEED. Every fetcher the gold family reaches for, answering with real
     candles rather than the rejection the app sees with no network. */
  const mk = (res, count) => bars(Math.max(10, Math.min(1500, count || 400)), TF[String(res)] || 3600, 7);
  ctx.getGoldCandles = async (res, count) => mk(res, count);
  ctx.getXAUCandles = async (res, count) => mk(res, count);
  ctx.getXmGoldCandles = async (res, count) => mk(res, count);
  ctx.binanceKlines = async (sym, res, count) => mk(res, count);
  ctx.hgOgFetchRows = async (tf, n) => mk(tf, n);
  return ctx;
}
const BAD = /\bNaN\b|\bundefined\b|\[object Object\]/;
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function drive(name, file){
  const sink = [];
  const C = boot(file, sink);
  const tab = (C.HG_tabs || []).filter(t => t && t.id === name)[0];
  if (!tab) return { tab: null, sink, before: 0, threw: 'not registered' };
  let threw = null;
  try { tab.mount(makeEl(sink)); } catch (e) { threw = 'mount: ' + e.message; }
  const before = sink.length;
  try { const r = tab.refresh && tab.refresh(); if (r && r.then) await r; }
  catch (e) { threw = (threw || '') + ' refresh: ' + e.message; }
  await sleep(200);
  return { tab, sink, before, threw, C };
}

console.log('== the feed is real, and the tabs take it ==');
{
  const C = boot(null, []);
  ok(typeof C.getGoldCandles === 'function' && typeof C.hgOgFetchRows === 'function',
     'every gold bar fetcher is stubbed');
  const rows = await C.getGoldCandles('4h', 300);
  ok(Array.isArray(rows) && rows.length === 300, `answering with ${rows.length} candles`);
  ok(rows.every(r => isFinite(r.o) && isFinite(r.h) && isFinite(r.l) && isFinite(r.c) && isFinite(r.t)),
     'every one of them a complete bar — this file tests the tabs, not their hole-handling');
  ok(rows[1].t - rows[0].t === 14400, 'spaced on the timeframe it was asked for');
}

console.log('\n== four gold tabs scan, and render from the bars ==');
{
  for (const [name, file] of Object.entries(SCANS)){
    const r = await drive(name, file);
    ok(!!r.tab, `${name} is registered`);
    ok(!r.threw, `${name} scans without throwing` + (r.threw ? ' — ' + r.threw : ''));
    const fresh = r.sink.length - r.before;
    ok(fresh > 0, `and renders ${fresh} chunk${fresh === 1 ? '' : 's'} it did not have before the scan`);
  }
}

console.log('\n== what the scan actually produced ==');
{
  /* Not "it rendered something" — it priced a setup off those candles. */
  const sw = await drive('goldswing', 'goldswing.js');
  const txt = sw.sink.map(strip).join(' · ');
  ok(/ATR14/.test(txt), 'GOLD SWING computed an ATR from the fed bars');
  ok(/R:R 1 : \d/.test(txt), `and priced a reward ratio from them (${(txt.match(/R:R 1 : [\d.]+/) || [])[0]})`);
  ok(/GRADE [A-F]/.test(txt), `and graded the setup (${(txt.match(/GRADE [A-F]/) || [])[0]})`);
  ok(/\d{4}\.\d{2}/.test(txt), 'quoting real price levels, so this is arithmetic and not a template');

  const sc = await drive('goldscalp', 'goldscalp.js');
  ok(/WEEKEND EXPOSURE|killzone|KILLZONE|silent|SILENT/i.test(sc.sink.map(strip).join(' ')),
     'GOLD SCALP reached its session and weekend ledgers');

  /* THE FEED IS LOAD-BEARING, and that is asserted rather than assumed. Pack
     841's harness left the fetchers rejecting and GOLD SWING rendered its
     shell and nothing else; the card above exists because these bars exist.
     Starve the feed and the card goes with it. */
  const starved = await (async () => {
    const sink = [];
    const C = boot('goldswing.js', sink);
    for (const k of ['getGoldCandles', 'getXAUCandles', 'getXmGoldCandles', 'binanceKlines', 'hgOgFetchRows'])
      C[k] = async () => [];
    const tab = (C.HG_tabs || []).filter(t => t && t.id === 'goldswing')[0];
    try { tab.mount(makeEl(sink)); } catch (e) {}
    try { const r = tab.refresh && tab.refresh(); if (r && r.then) await r; } catch (e) {}
    await sleep(200);
    return sink.map(strip).join(' ');
  })();
  ok(/feeds failed|no 4h klines|WHY SILENT/i.test(starved),
     'with the fetchers returning nothing, GOLD SWING says so — "feeds failed, no 4h klines from '
     + 'any source" — rather than pricing a card from nothing');
  ok(!/GRADE [A-F]/.test(starved),
     'and grades nothing, so the graded card above is measuring the fed bars and not a template');
  ok(!BAD.test(starved), 'and a starved scan still prints no NaN either');
}

console.log('\n== and nothing any of them printed is a number it does not have ==');
{
  const offenders = [];
  let chunks = 0;
  for (const [name, file] of Object.entries(SCANS)){
    const r = await drive(name, file);
    chunks += r.sink.length;
    for (const h of r.sink){
      const t = strip(h);
      if (!BAD.test(t)) continue;
      const m = t.match(/.{0,55}(NaN|undefined|\[object Object\]).{0,45}/);
      if (!offenders.some(o => o.indexOf(name) === 0)) offenders.push(name + ' :: ' + (m ? m[0] : t.slice(0, 90)));
    }
  }
  ok(offenders.length === 0,
     `${chunks} chunks across four scanned gold tabs: none printed NaN, undefined or [object Object]`
     + (offenders.length ? ('\n      ' + offenders.join('\n      ')) : ''));
  ok(chunks >= 14, `and ${chunks} chunks were inspected, not a handful`);
}

console.log('\n== the two this cannot reach are named, not dropped ==');
{
  /* A table that silently omits its failures is the vacuous-sweep problem in
     another shape. GOLD PRO and OMNIGOLD scan on an explicit user action, so
     refresh repaints and does not rescan. Asserted, so the day one of them
     becomes refresh-driven this stops being true and someone looks — and
     test-gold-tabs-press covers what happens when the button IS pressed. */
  for (const [name, file] of Object.entries(UNSCANNED)){
    const r = await drive(name, file);
    ok(!!r.tab, `${name} is registered and mounts`);
    ok(r.sink.length - r.before === 0,
       `${name} renders nothing new on refresh — it scans on an explicit action this harness cannot press`);
    ok(r.sink.length > 0, `its mount output (${r.sink.length} chunks) is still covered by test-gold-tabs-mount`);
  }
}

console.log('\n' + passed + ' passed, 0 failed');
