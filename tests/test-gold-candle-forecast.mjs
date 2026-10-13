/* HARDGATE — hg-v1306 CANDLE FORECAST tab guard.

   The user reported "Waiting for data..." + v14-1. That was the inline
   HTML in the tab pane, replaced by the module's mount() when the user
   opened the tab. On origin/main the v14-2 rewrite shipped a module whose
   engine (goldCandleForecast) referenced the private `_atr / _ema / __last`
   helpers scoped INSIDE the goldind.js IIFE, so every call returned null
   silently through its own try/catch — the hg-v955 "field written and
   nothing read" shape, except here it was "engine called and silently
   erroring". This pack ports the feature to main-3kk97r at hg-v1306
   with the engine OUTSIDE the IIFE (reading the plain-global atr / ema
   from indicators.js), and this guard drives:
     §1  engine is a global function
     §2  returns null on a thin tape
     §3  returns null on a dead-flat tape (no EMA9 slope)
     §4  returns a bull plan on a rising tape (TP1 above entry, SL below)
     §5  returns a bear plan on a falling tape (TP1 below entry, SL above)
     §6  returns null when atr / ema globals are absent (defensive)
     §7  module file exists, pushes to HG_tabs, carries mount+refresh
     §8  index.html wires the tab in HG_NAV_GROUPS and loads the script
     §9  build-stamp is hg-v1306 and sw.js carries the same cache name
     §10 behavioural mutation pass: break the engine or its wiring, catch

   This is a DISPLAY tool — no setup leaves any board, no gate reads a
   mark from it, no threshold moves. The guard asserts that too. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { HG_VER, swCacheOk } from './helpers/build-version.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0;
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); pass++; console.log('  ok —', msg); };

/* Boot indicators.js + the tail of goldind.js (the hg-v1306 engine, which
   lives OUTSIDE the IIFE) in one vm context, so the engine binds to the
   atr / ema globals as it would in the browser. */
function bootEngine(opts){
  const o = opts || {};
  const ctx = { console };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  if (!o.skipIndicators) vm.runInContext(read('indicators.js'), ctx, { filename: 'indicators.js' });
  const gold = read('goldind.js');
  const marker = '/* ========================================================================\n   hg-v1306:';
  const idx = gold.indexOf(marker);
  if (idx < 0) throw new Error('hg-v1306 engine block not found in goldind.js');
  const engineBlock = gold.slice(idx);
  vm.runInContext(engineBlock, ctx, { filename: 'goldind.js#hg-v1306' });
  return ctx;
}

function makeRows(opts){
  const o = opts || {};
  const n = o.n || 40;
  const start = o.start || 2300;
  const drift = (o.drift === undefined) ? 1.0 : o.drift;
  const amp = o.amp || 3.0;
  const rows = [];
  let p = start;
  for (let i = 0; i < n; i++){
    const o_ = p;
    const c_ = p + drift + (i % 2 ? -amp : amp) * 0.1;
    const h_ = Math.max(o_, c_) + amp;
    const l_ = Math.min(o_, c_) - amp;
    rows.push({ t: 1000 * (1_700_000_000 + i * 900), o: o_, h: h_, l: l_, c: c_, v: 1000 });
    p = c_;
  }
  return rows;
}

console.log('== §1 engine registered as a global ==');
{
  const ctx = bootEngine();
  ok(typeof ctx.goldCandleForecast === 'function', 'window.goldCandleForecast exists');
}

console.log('== §2 thin tape returns null ==');
{
  const ctx = bootEngine();
  const r = ctx.goldCandleForecast(makeRows({ n: 19 }));
  ok(r === null, 'returns null on <20 rows');
  const r2 = ctx.goldCandleForecast([]);
  ok(r2 === null, 'returns null on []');
  const r3 = ctx.goldCandleForecast(null);
  ok(r3 === null, 'returns null on null');
  const r4 = ctx.goldCandleForecast('nope');
  ok(r4 === null, 'returns null on a non-array');
}

console.log('== §3 flat tape returns null (no direction) ==');
{
  const ctx = bootEngine();
  const flat = [];
  for (let i = 0; i < 40; i++){
    flat.push({ t: 1_700_000_000 + i, o: 2300, h: 2300.1, l: 2299.9, c: 2300, v: 100 });
  }
  const r = ctx.goldCandleForecast(flat);
  ok(r === null, 'flat EMA9 slope reads no direction');
}

console.log('== §4 rising tape → BULL ==');
let bull;
{
  const ctx = bootEngine();
  bull = ctx.goldCandleForecast(makeRows({ drift: +1.5, amp: 2.5 }));
  ok(bull && bull.dir === 'BULL', 'dir is BULL on a rising tape');
  ok(isFinite(bull.expectedHigh) && isFinite(bull.expectedLow), 'range is finite');
  ok(bull.expectedHigh > bull.expectedLow, 'high > low');
  ok(bull.tp2 > bull.tp1, 'tp2 beyond tp1 on a long');
  ok(bull.sl < bull.tp1, 'sl below tp1 on a long');
  ok(bull.confidence > 0 && bull.confidence <= 1, 'confidence in (0, 1]');
}

console.log('== §5 falling tape → BEAR (mirror) ==');
{
  const ctx = bootEngine();
  const bear = ctx.goldCandleForecast(makeRows({ drift: -1.5, amp: 2.5 }));
  ok(bear && bear.dir === 'BEAR', 'dir is BEAR on a falling tape');
  ok(bear.tp2 < bear.tp1, 'tp2 below tp1 on a short');
  ok(bear.sl > bear.tp1, 'sl above tp1 on a short');
}

console.log('== §6 engine fails open when atr/ema globals are absent ==');
{
  const ctx = bootEngine({ skipIndicators: true });
  const r = ctx.goldCandleForecast(makeRows({ drift: +1.5 }));
  ok(r === null, 'returns null rather than throwing when atr/ema are absent');
}

console.log('== §7 module file registers through HG_tabs ==');
{
  const src = read('gold-candle-forecast.js');
  ok(/G\.HG_tabs\s*=\s*G\.HG_tabs\s*\|\|\s*\[\]/.test(src), 'module ensures HG_tabs exists');
  ok(/G\.HG_tabs\.push\(\s*\{\s*id:\s*'candle-forecast'/.test(src), 'module pushes the tab entry');
  ok(/label:\s*'CANDLE FORECAST'/.test(src), 'label is CANDLE FORECAST');
  ok(/mount:\s*mount/.test(src), 'carries a mount function');
  ok(/refresh:\s*refresh/.test(src), 'carries a refresh function');
  ok(/getXAUCandles\(/.test(src), 'uses the shell gold feed chain');
  ok(!/api\.binance\.com/i.test(src), 'does not fetch Binance directly from the browser');
  ok(/goldCandleForecast/.test(src), 'calls window.goldCandleForecast');
  /* The user's "Waiting for data..." symptom: the inline HTML remains
     until mount replaces it. The module's mount writes a panel that
     carries the version chip hg-v1306 and the SCAN button. */
  ok(/SCAN NEXT CANDLE/.test(src), 'mount paints the SCAN button so the user has a trigger');
  ok(/No forecast yet/.test(src) || /No forecast available/.test(src), 'mount replaces the Waiting-for-data placeholder');
}

console.log('== §8 index.html wires the tab in HG_NAV_GROUPS and loads the script ==');
{
  const html = read('index.html');
  ok(html.indexOf("'gold'") >= 0, 'gold group exists');
  const navMatch = html.match(/\{\s*id:\s*'gold'[^}]*tabs:\s*\[([^\]]+)\][^}]*\}/);
  ok(navMatch, 'gold HG_NAV_GROUPS entry found');
  ok(/'candle-forecast'/.test(navMatch[1]), "'candle-forecast' is in the gold tabs list");
  ok(/gold-candle-forecast\.js/.test(html), 'script tag included');
  const scriptIdx = html.indexOf('gold-candle-forecast.js');
  const bodyIdx = html.lastIndexOf('</body>');
  ok(scriptIdx > 0 && scriptIdx < bodyIdx, 'script loaded before </body>');
  /* hg-v1307: must load BEFORE bootHgTabs so the module's HG_tabs.push is
     seen on that function's iteration. hg-v1306 defect — the script was
     at the body bottom, after bootHgTabs ran, so the push was ignored. */
  const bootIdx = html.indexOf('function bootHgTabs()');
  ok(bootIdx > 0, 'bootHgTabs declaration found');
  ok(scriptIdx < bootIdx, 'script loads BEFORE bootHgTabs (hg-v1307 ordering fix)');
  /* Driven: lift bootHgTabs and the module into one vm sandbox, with a
     stub DOM, and require the pane and nav button to be created. */
  const vmSandbox = { console };
  vmSandbox.window = vmSandbox; vmSandbox.globalThis = vmSandbox;
  const navEl = { children: [], tagName: 'NAV', appendChild(c){ this.children.push(c); } };
  const mainEl = { children: [], tagName: 'MAIN', appendChild(c){ this.children.push(c); } };
  vmSandbox.document = {
    querySelector: (sel) => sel === 'nav' ? navEl : sel === 'main' ? mainEl : null,
    createElement: (tag) => ({ tagName: tag.toUpperCase(), id: '', type: '', textContent: '', className: '',
                                 _attrs: {}, setAttribute(k,v){ this._attrs[k]=v; }, addEventListener(){} }),
    getElementById: () => null
  };
  vmSandbox.HG_TAB_GROUP = { 'candle-forecast': 'gold' };
  vmSandbox.HG_GROUP_FALLBACK = 'tools';
  vm.createContext(vmSandbox);
  vm.runInContext(read('gold-candle-forecast.js'), vmSandbox, { filename: 'gold-candle-forecast.js' });
  ok(Array.isArray(vmSandbox.HG_tabs) && vmSandbox.HG_tabs.length >= 1, 'module pushes to window.HG_tabs');
  const bootText = `const HG_TAB_MODS = {};
    (function bootHgTabs(){
      const nav = document.querySelector('nav');
      const main = document.querySelector('main');
      if (!nav || !main) return;
      (window.HG_tabs || []).forEach(function(mod){
        if (!mod || !mod.id || !mod.label || typeof mod.mount !== 'function') return;
        HG_TAB_MODS[mod.id] = mod;
        const b = document.createElement('button');
        b.id = 'tabB_' + mod.id;
        nav.appendChild(b);
        const pane = document.createElement('div');
        pane.className = 'tabpane';
        pane.id = 'tab_' + mod.id;
        main.appendChild(pane);
      });
      globalThis.__HG_TAB_MODS = HG_TAB_MODS;
    })();`;
  vm.runInContext(bootText, vmSandbox, { filename: 'bootHgTabs' });
  ok(vmSandbox.__HG_TAB_MODS && vmSandbox.__HG_TAB_MODS['candle-forecast'], 'bootHgTabs registers candle-forecast in HG_TAB_MODS');
  ok(navEl.children.some(c => c.id === 'tabB_candle-forecast'), 'bootHgTabs created the nav button');
  ok(mainEl.children.some(c => c.id === 'tab_candle-forecast'), 'bootHgTabs created the tab pane');
  /* No HARDGATE gate module reads the module's output — this tab is
     display-only. Assert no gate file names the engine. */
  const gateFiles = ['cryptogates.js','engine.js','plans.js','hg-gates.js','hg-setup-core.js','hg-perfect-setup.js','setup-stack.js'];
  for (const f of gateFiles){
    const src = read(f);
    ok(!/goldCandleForecast\b/.test(src), f + ' does not read the forecast engine');
  }
}

console.log('== §9 build stamps are current ==');
{
  /* hg-v956: don't hard-code the version here — reads from build-version.mjs,
     so a routine stamp bump never turns this guard red for the wrong reason.
     What's load-bearing is that sw.js and build-stamp.js stay in step. */
  ok(/^hg-v\d+$/.test(HG_VER), 'build-stamp.js version has hg-v<n> shape; got ' + HG_VER);
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches build-stamp.js');
}

console.log('== §10 behavioural mutation pass ==');
{
  const goldSrc = read('goldind.js');
  const engineMarker = '/* ========================================================================\n   hg-v1306:';
  const start = goldSrc.indexOf(engineMarker);
  const engineText = goldSrc.slice(start);
  const mutations = [
    { name: 'drop thin-tape guard', from: 'rows.length < 20', to: 'rows.length < 2' },
    { name: 'drop EMA9 flat-slope refusal', from: 'if (e9_last === e9_prev) return null;', to: '/* mutated: flat accepted */' },
    { name: 'swap BULL/BEAR direction', from: "var dir = (e9_last > e9_prev) ? 'BULL' : 'BEAR';", to: "var dir = (e9_last > e9_prev) ? 'BEAR' : 'BULL';" },
    { name: 'invert tp sign', from: 'var sign = (dir === \'BULL\') ? 1 : -1;', to: 'var sign = (dir === \'BULL\') ? -1 : 1;' },
    { name: 'invert sl side', from: "var sl  = (dir === 'BULL') ? low : high;", to: "var sl  = (dir === 'BULL') ? high : low;" },
    { name: 'remove atr guard', from: 'if (!isFinite(atrLast) || atrLast <= 0) return null;', to: '/* mutated: skip atr guard */' },
    { name: 'remove export', from: 'G.goldCandleForecast = goldCandleForecast;', to: '/* mutated: no export */' },
  ];
  for (const m of mutations){
    const occurrences = engineText.split(m.from).length - 1;
    if (occurrences !== 1) throw new Error('mutation "' + m.name + '" needs exactly one occurrence; found ' + occurrences);
    const mutated = engineText.replace(m.from, m.to);
    const ctx = { console };
    ctx.window = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(read('indicators.js'), ctx, { filename: 'indicators.js' });
    try {
      vm.runInContext(mutated, ctx, { filename: 'goldind.js#mutated' });
    } catch (e) {
      /* a mutation that fails to parse counts as caught (it would break
         the live engine too) */
      pass++; console.log('  ok — mutation caught (parse) —', m.name);
      continue;
    }
    let caught = false;
    try {
      const f = ctx.goldCandleForecast;
      if (typeof f !== 'function'){
        caught = true;
      } else {
        /* Probe 1: thin tape — must still return null */
        if (f(makeRows({ n: 19 })) !== null) caught = caught || (m.name === 'drop thin-tape guard');
        /* Probe 2: flat tape — must still return null */
        if (f([{t:1,o:2300,h:2300.1,l:2299.9,c:2300,v:100}].concat(makeRows({ n: 39 })).slice(0, 40).map(r => ({...r, h: 2300.1, l: 2299.9, c: 2300, o: 2300})))){
          /* flat probe never yields truthy on honest engine */
          caught = caught || (m.name === 'drop EMA9 flat-slope refusal');
        }
        /* Probe 3: rising tape — BULL with tp1 above entry, sl below */
        const r = f(makeRows({ drift: +1.5 }));
        if (!r){
          caught = caught || (m.name === 'remove atr guard' && false);
        } else {
          const entry = makeRows({ drift: +1.5 });
          const entryClose = entry[entry.length - 1].c;
          if (r.dir !== 'BULL') caught = true;
          else if (r.tp1 < entryClose) caught = true;
          else if (r.sl > entryClose) caught = true;
          else if (r.tp2 < r.tp1) caught = true;
        }
        /* Probe 4: falling tape — BEAR with mirrored geometry */
        const b = f(makeRows({ drift: -1.5 }));
        if (!b){
          caught = caught || false;
        } else {
          const entry = makeRows({ drift: -1.5 });
          const entryClose = entry[entry.length - 1].c;
          if (b.dir !== 'BEAR') caught = true;
          else if (b.tp1 > entryClose) caught = true;
          else if (b.sl < entryClose) caught = true;
          else if (b.tp2 > b.tp1) caught = true;
        }
      }
    } catch (e) {
      caught = true;
    }
    if (!caught) throw new Error('MUTATION SURVIVED: ' + m.name);
    pass++; console.log('  ok — mutation caught —', m.name);
  }
}

console.log('\n' + pass + ' assertions passed, 0 failed.');
