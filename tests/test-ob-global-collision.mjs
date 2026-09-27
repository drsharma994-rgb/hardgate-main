/* HARDGATE — hgDetectOrderBlock global collision regression guard.

   THE BUG. Two different functions shared one global name:
     - structure-levels.js  hgDetectOrderBlock(rows, dir)  -> {entry, zone, poi:'ob', idx}
     - order-block.js       hgDetectOrderBlock(candles, index) -> {type:'BULLISH_OB', blockHigh...}
   order-block.js loads after structure-levels.js in index.html and assigned
   its own function to the same window global, so every caller passing
   (rows, 'long'|'short') — formation.js's POI ranker, supersetup.js's OB
   trigger, contract-report.js's structure row, gold-best-levels.js's OB
   score — landed in a function expecting an integer index. `index < 4` is
   false for the string 'long', the body then read candles['long'].close,
   threw inside its own try/catch, and returned null. Every time. The
   order-block POI never fired once in production, and nothing saw it:
   per-file unit tests load structure-levels.js WITHOUT order-block.js, and
   the throw happened inside the callee's own catch.

   THE FIX. order-block.js's index-based detector is now hgDetectOrderBlockAt
   and exports under that name; the shared global keeps structure-levels.js's
   direction-based semantics, which is what every (rows, dir) caller wants.

   THIS TEST loads the two files in the page's real load order (parsed from
   index.html, not hand-listed) and proves:
     1. the global hgDetectOrderBlock answers (rows, dir) with the
        direction-based contract — and actually FIRES on a fixture, so the
        assertion is not vacuously satisfied by an always-null function;
     2. the index-based detector still exists under hgDetectOrderBlockAt and
        fires on its own long-form candle contract;
     3. no later-loaded page script re-clobbers the global.

   Run: node tests/test-ob-global-collision.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)), path.sep);
let pass = 0;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); pass++; console.log('  ok —', m); };

/* The page's own load order for the two parties, parsed not assumed. */
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pageOrder = [...html.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi)]
  .map(m => m[1].split('?')[0].replace(/^\.\//, ''));
const iLevels = pageOrder.indexOf('structure-levels.js');
const iOb = pageOrder.indexOf('order-block.js');
ok(iLevels > -1 && iOb > -1, 'both structure-levels.js and order-block.js are page scripts');
ok(iLevels < iOb, 'structure-levels.js loads before order-block.js (the collision direction)');

function boot(){
  const sandbox = Object.assign({
    console, setTimeout, clearTimeout, Math, JSON, Array, Object, String, Number, isFinite, Infinity,
  });
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'indicators.js'), 'utf8'), ctx, { filename: 'indicators.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'structure-levels.js'), 'utf8'), ctx, { filename: 'structure-levels.js' });
  vm.runInContext(fs.readFileSync(path.join(root, 'order-block.js'), 'utf8'), ctx, { filename: 'order-block.js' });
  return sandbox;
}

/* Rows with a real bullish order block: a down close whose NEXT bar displaces
   >= 0.85xATR and closes above its high, inside the detector's 40-bar scan
   window. Flat base -> dip bar -> displacement bar -> drift. */
function rowsWithBullOb(){
  const out = [];
  let p = 100;
  for (let i = 0; i < 60; i++){
    p += (i % 2 === 0 ? 0.05 : -0.05);
    out.push({ t: i * 14400, o: p - 0.02, h: p + 0.12, l: p - 0.12, c: p, v: 1000 });
  }
  /* the OB bar: bearish */
  out.push({ t: 60 * 14400, o: p, h: p + 0.10, l: p - 0.55, c: p - 0.50, v: 1100 });
  /* the displacement bar: bullish, body >> ATR, closes above the OB bar's high */
  out.push({ t: 61 * 14400, o: p - 0.48, h: p + 0.75, l: p - 0.52, c: p + 0.70, v: 2600 });
  p += 0.70;
  for (let i = 62; i < 70; i++){
    p += 0.06;
    out.push({ t: i * 14400, o: p - 0.03, h: p + 0.14, l: p - 0.10, c: p, v: 1200 });
  }
  return out;
}

console.log('== the shared global carries structure-levels semantics after BOTH files load ==');
{
  const sb = boot();
  ok(typeof sb.hgDetectOrderBlock === 'function', 'hgDetectOrderBlock exists');
  const rows = rowsWithBullOb();
  const ob = sb.hgDetectOrderBlock(rows, 'long');
  /* VACUITY GUARD: the fixture MUST produce the POI. With the collision in
     place this call returned null 100% of the time — an assertion of the form
     "null or valid" would pass while the desk stayed dead. */
  ok(ob && typeof ob === 'object', 'bullish OB fixture fires the direction-based detector (not null)');
  ok(ob && isFinite(+ob.entry) && ob.poi === 'ob' && ob.zone && isFinite(+ob.zone.lo) && isFinite(+ob.zone.hi),
    'direction-based contract: {entry, zone{lo,hi}, poi:"ob"} — the shape formation/supersetup/contract-report/gold-best-levels consume');
  ok(ob && typeof ob.idx === 'number' && ob.idx > 0 && ob.idx < rows.length, 'carries the source bar index (gold-best-levels ages the OB off it)');
  const none = sb.hgDetectOrderBlock(rows, 'short');
  ok(none === null || (none && isFinite(+none.entry) && none.poi === 'ob'),
    'short scan on a bullish-OB fixture: null or a valid bearish OB — never a throw, never a wrong-shape object');
}

console.log('== the index-based detector survives under its own name ==');
{
  const sb = boot();
  ok(typeof sb.hgDetectOrderBlockAt === 'function', 'hgDetectOrderBlockAt exported');
  /* order-block.js works on long-form candles {open,high,low,close} */
  const candles = [];
  for (let i = 0; i < 8; i++){
    const p = 100 + i * 0.1;
    candles.push({ open: p, high: p + 0.2, low: p - 0.2, close: p + 0.1 });
  }
  candles.push({ open: 100.9, high: 101.0, low: 100.4, close: 100.5 });  /* bearish */
  candles.push({ open: 100.5, high: 101.6, low: 100.45, close: 101.5 }); /* bullish, breaks prev high */
  const ob = sb.hgDetectOrderBlockAt(candles, candles.length - 1);
  ok(ob && ob.type === 'BULLISH_OB' && isFinite(ob.blockHigh) && isFinite(ob.blockLow),
    'index-form detector fires on its own contract (used by hgDetectSmartMoneyZones)');
  const zones = sb.hgDetectSmartMoneyZones(candles);
  ok(zones && Array.isArray(zones.zones) && zones.count === zones.zones.length,
    'hgDetectSmartMoneyZones composite still works after the rename');
}

console.log('== load-order sweep: no page script after structure-levels re-clobbers the global ==');
{
  /* Parse every page script, load in order up to and including the LAST file
     that mentions hgDetectOrderBlock, then check the contract again. This is
     the assertion that would have caught the original bug. */
  const sandbox = Object.assign({
    console, setTimeout, clearTimeout, Math, JSON, Array, Object, String, Number, isFinite, Infinity,
    fetch: () => Promise.reject(new Error('offline')),
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, appendChild(){}, setAttribute(){}, getContext: () => null }), addEventListener(){}, body: null, hidden: false },
    location: { hostname: 'localhost', search: '', href: 'http://localhost/' },
    navigator: { onLine: true },
    requestAnimationFrame: fn => setTimeout(fn, 0),
  });
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of pageOrder){
    const fp = path.join(root, f);
    if (!fs.existsSync(fp)) continue;
    if (/vendor[\/]/.test(f)) continue;
    try{ vm.runInContext(fs.readFileSync(fp, 'utf8'), ctx, { filename: f }); }catch(e){ /* boot stubs are minimal; a script that wants more DOM is not on trial here */ }
  }
  const rows = rowsWithBullOb();
  const ob = sandbox.hgDetectOrderBlock && sandbox.hgDetectOrderBlock(rows, 'long');
  ok(ob && isFinite(+ob.entry) && ob.poi === 'ob',
    'after EVERY page script loads, hgDetectOrderBlock(rows,"long") still fires the direction-based detector');
}

console.log(`\n${pass} checks passed`);
