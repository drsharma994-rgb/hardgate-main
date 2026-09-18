/* HARDGATE — every gold tab mounts, and renders nothing it does not have.

   Pack 840 swept the gold family for NaN, undefined and [object Object] in
   rendered text, and had to state a caveat: GOLD SCALP, GOLD SWING, GOLD PRO
   and TAURIC are IIFE-scoped and export four to eight functions each, so
   there was almost nothing at module scope to call. Their zero was "nothing
   reachable", not "nothing wrong".

   This file reaches them the way the app does — through the mount function
   each tab registers on HG_tabs — and drives that path in three modes: every
   engine loaded, every engine absent, every engine throwing. The degraded
   modes are the point. The pack 839 fail-open gate and the pack 840 NaN
   lines both lived where a dependency was missing or threw.

   THE FIRST VERSION OF THIS HARNESS WAS VACUOUS AND IS WORTH RECORDING.
   HG_tabs already holds OmniRoute from the shared modules, so selecting
   HG_tabs[0] mounted OmniRoute six times and reported a confident zero for
   six tabs it never touched. Every tab is now selected by its own id, and
   asserted to have rendered its OWN copy — a sweep that cannot prove it
   reached its subject is worse than no sweep, because it reads as evidence.

   Run: node tests/test-gold-tabs-mount.mjs */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0;
const ok = (cond, label) => { if (!cond) throw new Error('FAIL: ' + label); passed++; console.log('  ok —', label); };

const BASE = ['indicators.js', 'indicators2.js', 'fixpack14-core.js', 'hg-mechanics.js',
              'hg-forward.js', 'goldind.js', 'formation.js', 'plans.js', 'hg-gates.js',
              'hg-plan.js', 'omniroute.js', 'setup-ui.js'];
/* id -> file. The ID matters: see the header. */
const TABS = { goldscalp: 'goldscalp.js', goldswing: 'goldswing.js', goldpro: 'goldpro.js',
               tauric: 'tauric.js', '80percent': 'eightypercent.js', omnigold: 'omnigold.js' };
/* a word each tab's own shell prints, so "it mounted" can be proved */
const OWN = { goldscalp: /GOLD SCALP/i, goldswing: /GOLD SWING/i, goldpro: /GOLD PRO/i,
              tauric: /TAURIC/i, '80percent': /80PERCENT/i, omnigold: /OmniGold/i };
const ENGINES = ['hgGoldInstFilter', 'goldKillzone', 'hgAtrPercentile', 'calculateGoldSpotBasis',
                 'detectRegime', 'goldMarketStructure', 'hgCoint', 'volumeProfile', 'hgWilson',
                 'hgFwdStats', 'hgFwdPool', 'hgOgFetchRows', 'hgGoldVpPlaybook', 'hgSmcChipHtml',
                 'hgFillProbability'];
const MODES = [['all loaded', null], ['engines absent', 'absent'], ['engines throw', 'throw']];

function makeEl(sink){
  const el = { _html: '', style: {}, dataset: {}, classList: { add(){}, remove(){}, contains: () => false },
               children: [], appendChild(c){ el.children.push(c); return c; }, removeChild(){}, remove(){},
               setAttribute(){}, getAttribute: () => null, addEventListener(){}, removeEventListener(){},
               querySelector: () => makeEl(sink), querySelectorAll: () => [],
               insertAdjacentHTML(_, h){ sink.push(String(h)); },
               focus(){}, click(){}, textContent: '', value: '' };
  Object.defineProperty(el, 'innerHTML', {
    get(){ return el._html; },
    set(v){ el._html = String(v); sink.push(String(v)); } });
  return el;
}
const T = 1700000000;
function seedStore(){
  const st = Object.create(null), recs = [];
  for (let i = 0; i < 40; i++){
    const w = i < 28;
    for (const tab of ['OMNIGOLD:SCALP', 'OMNIGOLD:SWING', 'GOLDSCALP', 'GOLDSWING', 'SUPER:GOLD'])
      recs.push({ tab, mechanic: 'ROUND-MAGNET', sym: 'XAUUSD', tf: '1h', dir: i % 2 ? 'long' : 'short',
                  entry: 4000, stop: 3980, t1: 4040, risk: 20, rr: 2, barT: T + i * 172800,
                  horizonBars: 20, state: w ? 't1' : 'stop', r: w ? 2 : -1,
                  settledT: T + i * 172800 + 3600, ticket: true, gateClear: true, shown: true });
  }
  st['hg_forward_v1'] = JSON.stringify(recs);
  st['hg_score_v1'] = JSON.stringify(Array.from({ length: 60 },
    (_, i) => ({ status: 'settled', r: i < 40 ? 0.5 : -1, sym: 'XAUUSD', dir: 'long' })));
  st['hg_og_drawdown_state'] = JSON.stringify({ weekStart: '2026-03-09', weekPnl: -1.2,
    losStreak: 3, settles: 9, isCircuitBreakerActive: false });
  return st;
}
function boot(file, sink){
  const store = seedStore();
  const doc = { createElement: () => makeEl(sink), createDocumentFragment: () => makeEl(sink),
                getElementById: () => makeEl(sink), querySelector: () => makeEl(sink),
                querySelectorAll: () => [], head: makeEl(sink), body: makeEl(sink),
                documentElement: makeEl(sink), addEventListener(){}, removeEventListener(){} };
  const ctx = { console: { log(){}, warn(){}, error(){} }, Math, isFinite, isNaN, parseFloat,
                parseInt, Number, String, Object, Array, JSON, Date, RegExp, document: doc,
                setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
                requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
                addEventListener: () => {}, removeEventListener: () => {},
                fetch: () => Promise.reject(new Error('no net')), Promise, Error, NaN, Infinity,
                encodeURIComponent, decodeURIComponent,
                localStorage: { getItem: k => (k in store ? store[k] : null),
                                setItem: (k, v) => { store[k] = String(v); },
                                removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.HG_tabs = []; ctx.HG_warmups = [];
  ctx.location = { href: '', search: '', hash: '' };
  ctx.navigator = { userAgent: 'node', onLine: false };
  vm.createContext(ctx);
  for (const f of BASE.concat([file])){
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
    catch (e) { /* optional deps degrade, as in the app */ }
  }
  return ctx;
}
const BAD = /\bNaN\b|\bundefined\b|\[object Object\]/;
const strip = h => String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

function run(name, file, mode){
  const sink = [];
  const C = boot(file, sink);
  if (mode === 'absent') for (const k of ENGINES) C[k] = undefined;
  if (mode === 'throw') for (const k of ENGINES) C[k] = function(){ throw new Error('boom'); };
  const ids = (C.HG_tabs || []).map(t => t && t.id);
  const tab = (C.HG_tabs || []).filter(t => t && t.id === name && typeof t.mount === 'function')[0];
  let threw = null;
  if (tab){
    try { tab.mount(makeEl(sink)); } catch (e) { threw = e; }
    try { if (typeof tab.refresh === 'function') tab.refresh(); } catch (e) {}
  }
  const text = sink.map(strip).join(' · ');
  return { tab, ids, threw, sink, text };
}

console.log('== the harness reaches the tab it names ==');
{
  /* THE GUARD THAT MAKES THE REST MEAN ANYTHING. Selecting HG_tabs[0]
     mounted OmniRoute six times and called it six clean gold tabs. */
  const r = run('goldscalp', 'goldscalp.js', null);
  ok(r.ids.indexOf('omniroute') >= 0,
     `HG_tabs already holds ${JSON.stringify(r.ids)} — picking [0] would mount the wrong tab`);
  ok(r.ids[0] !== 'goldscalp', 'and the tab under test is NOT first, which is how that went unnoticed');
  ok(r.tab && r.tab.id === 'goldscalp', 'selection is by id, so the right tab is mounted');
  ok(OWN.goldscalp.test(r.text), 'and its own copy appears in what it rendered');
}

console.log('\n== every gold tab registers and mounts ==');
{
  for (const [name, file] of Object.entries(TABS)){
    const r = run(name, file, null);
    ok(!!r.tab, `${name} registers a mount on HG_tabs`);
    ok(!r.threw, `${name} mounts without throwing` + (r.threw ? ' — ' + r.threw.message : ''));
    ok(r.sink.length > 0, `${name} renders ${r.sink.length} html chunk${r.sink.length === 1 ? '' : 's'}`);
    ok(OWN[name].test(r.text), `and the chunks are its own, not another tab's`);
  }
}

console.log('\n== and renders nothing it does not have, in three modes ==');
{
  const offenders = [];
  let runs = 0, chunks = 0;
  for (const [name, file] of Object.entries(TABS)){
    for (const [modeName, mode] of MODES){
      const r = run(name, file, mode);
      runs++;
      chunks += r.sink.length;
      if (r.threw) offenders.push(name + ' / ' + modeName + ' :: THREW ' + r.threw.message.slice(0, 60));
      for (const h of r.sink){
        const t = strip(h);
        if (!BAD.test(t)) continue;
        const m = t.match(/.{0,60}(NaN|undefined|\[object Object\]).{0,50}/);
        const line = name + ' / ' + modeName + ' :: ' + (m ? m[0] : t.slice(0, 90));
        if (!offenders.some(o => o.indexOf(name + ' / ' + modeName) === 0)) offenders.push(line);
      }
    }
  }
  ok(runs === Object.keys(TABS).length * MODES.length,
     `${runs} mounts — ${Object.keys(TABS).length} gold tabs x ${MODES.length} dependency modes`);
  ok(offenders.length === 0,
     `${chunks} rendered chunks: none threw, none printed NaN, undefined or [object Object]`
     + (offenders.length ? ('\n      ' + offenders.join('\n      ')) : ''));

  /* NOT VACUOUS: the modes have to change what the tabs do, or three passes
     of the same thing are being counted as three. */
  const a = run('80percent', 'eightypercent.js', null).sink.length;
  const b = run('80percent', 'eightypercent.js', 'throw').sink.length;
  ok(a !== b,
     `80PERCENT renders ${a} chunks with its engines and ${b} with them throwing — the modes bite`);
  ok(chunks > 40, `and ${chunks} chunks were actually inspected`);
}

console.log('\n' + passed + ' passed, 0 failed');
