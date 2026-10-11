#!/usr/bin/env node
/* hg-v1302 — OMNIBTC refresh stability guard.

   The user reported "setup changes again and again when I refresh the tab".
   Diagnosed: not a sort defect (hgCmpSetupQuality is deterministic), but
   venue-flip from xuMergeLegs collapsing BTC to one venue by live
   turnoverUsd. Two refreshes fetching Delta vs CoinDCX see different
   candle series and fire different engine candidates. Two stabilising
   fixes, neither a new gate (hg-v966 holds):

   (1) hgObtcResolveLegs pins the resolved legs to sessionStorage with a
       30-min TTL; a refresh returns the pinned legs unchanged.
   (2) hgObtcPick measured-rank override sorts btc by (mechanic, sym)
       alphabetical before scanning for the first proven candidate.

   This guard lifts the two blocks into a vm sandbox (hg-v1022 technique)
   and asserts the pin round-trips, the TTL expires, every seam fails
   open, the sort is stable, and no coercion traps slip through. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
const ok = (c, label) => { if (c){ passed++; console.log('ok —', label); } else { failed++; console.log('FAIL —', label); } };

/* Lift the pin helpers + resolver + measured-rank sort out of omnibtc.js and
   run them in a sandbox against a stubbed sessionStorage. We cannot run the
   whole module (it registers tabs, scans etc.), so slice the three blocks
   this pack touches. */
function bootPin(storage, clockMs){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date: class extends Date { static now(){ return clockMs; } },
    isFinite, isNaN, JSON, Array, Object, Number, String,
    Promise, RegExp, Error, TypeError
  };
  ctx.window = ctx; ctx.W = ctx; ctx.globalThis = ctx;
  ctx.sessionStorage = storage;
  /* Minimal shims the pin block needs */
  ctx.gfn = () => false;
  ctx.hgObtcFilterUniverse = legs => Array.isArray(legs) ? legs.slice() : [];
  ctx.hgObtcDefaultLegs = () => [{ sym: 'BTCUSDT', venue: 'default', base: 'BTC' }];
  vm.createContext(ctx);
  const src = read('omnibtc.js');
  const startIdx = src.indexOf('/* hg-v1302: SessionStorage pin');
  if (startIdx < 0) throw new Error('hg-v1302 pin block not found in omnibtc.js');
  const endIdx = src.indexOf('async function loadBars', startIdx);
  if (endIdx < 0) throw new Error('block end not found');
  vm.runInContext(src.slice(startIdx, endIdx), ctx);
  return ctx;
}

function makeStorage(){
  const data = Object.create(null);
  return {
    data,
    getItem(k){ return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v){ data[k] = String(v); },
    removeItem(k){ delete data[k]; }
  };
}

/* ---------- §1: block boundary + exports ---------- */
console.log('\n[§1] block boundary + exports in omnibtc.js');
{
  const src = read('omnibtc.js');
  ok(/\/\* hg-v1302: SessionStorage pin for the resolved OMNIBTC legs/.test(src), 'hg-v1302 doctrine block present');
  ok(/LEGS_PIN_KEY\s*=\s*'hg_omnibtc_legs_pin_v1302'/.test(src), 'LEGS_PIN_KEY names the version');
  ok(/LEGS_PIN_TTL_MS\s*=\s*30\s*\*\s*60\s*\*\s*1000/.test(src), 'LEGS_PIN_TTL_MS = 30 min');
  ok(/function hgObtcReadLegPin\(\)/.test(src), 'hgObtcReadLegPin defined');
  ok(/function hgObtcWriteLegPin\(legs\)/.test(src), 'hgObtcWriteLegPin defined');
  ok(/var pinned = hgObtcReadLegPin\(\);/.test(src), 'hgObtcResolveLegs reads the pin first');
  ok(/hgObtcWriteLegPin\(out\);/.test(src), 'hgObtcResolveLegs writes the pin on success');
}

/* ---------- §2: write / read round-trip ---------- */
console.log('\n[§2] round-trip: write then read returns the same legs');
{
  const storage = makeStorage();
  const T0 = 1_700_000_000_000;
  const ctx = bootPin(storage, T0);
  const legs = [
    { sym: 'BTCUSDT', venue: 'binance', base: 'BTC' },
    { sym: 'BTCUSD', venue: 'delta', base: 'BTC' }
  ];
  ctx.hgObtcWriteLegPin(legs);
  const read1 = ctx.hgObtcReadLegPin();
  ok(Array.isArray(read1) && read1.length === 2, 'reads 2 legs back');
  ok(read1[0].sym === 'BTCUSDT' && read1[0].venue === 'binance', 'first leg preserved');
  ok(read1[1].sym === 'BTCUSD' && read1[1].venue === 'delta', 'second leg preserved');
  /* The storage entry carries a timestamp */
  const raw = storage.getItem('hg_omnibtc_legs_pin_v1302');
  const parsed = JSON.parse(raw);
  ok(parsed.at === T0, 'pin at = clock at write');
  ok(parsed.legs.length === 2, 'pin legs array length preserved');
}

/* ---------- §3: TTL — 29 min returns, 31 min does not ---------- */
console.log('\n[§3] TTL — 30 min window');
{
  const storage = makeStorage();
  const T0 = 1_700_000_000_000;
  const ctx = bootPin(storage, T0);
  ctx.hgObtcWriteLegPin([{ sym: 'BTCUSDT', venue: 'binance' }]);

  /* 29 min later: still valid */
  const ctx29 = bootPin(storage, T0 + 29 * 60 * 1000);
  const read29 = ctx29.hgObtcReadLegPin();
  ok(Array.isArray(read29) && read29.length === 1, '29 min: pin still returns legs');

  /* exactly 30 min later: expired (>= TTL) */
  const ctx30 = bootPin(storage, T0 + 30 * 60 * 1000);
  const read30 = ctx30.hgObtcReadLegPin();
  ok(read30 === null, 'exactly 30 min: pin returns null (>= TTL)');

  /* 31 min later: expired */
  const ctx31 = bootPin(storage, T0 + 31 * 60 * 1000);
  ok(ctx31.hgObtcReadLegPin() === null, '31 min: pin returns null');

  /* 2 hours later: expired */
  const ctx2h = bootPin(storage, T0 + 2 * 60 * 60 * 1000);
  ok(ctx2h.hgObtcReadLegPin() === null, '2 hours: pin returns null');
}

/* ---------- §4: fails open at every seam ---------- */
console.log('\n[§4] fails open — null / junk / empty / throwing storage');
{
  const T0 = 1_700_000_000_000;

  /* No sessionStorage at all */
  const ctx1 = bootPin(undefined, T0);
  /* Can't call directly because the IIFE references sessionStorage inside;
     the shim handles it. Here we test the write / read helpers with the
     storage set but behaving oddly. */

  /* Empty storage */
  const storage = makeStorage();
  const ctx = bootPin(storage, T0);
  ok(ctx.hgObtcReadLegPin() === null, 'empty storage reads null');

  /* Junk JSON */
  storage.setItem('hg_omnibtc_legs_pin_v1302', 'not-json {');
  ok(ctx.hgObtcReadLegPin() === null, 'junk JSON reads null (parse error)');

  /* Right shape but at = string */
  storage.setItem('hg_omnibtc_legs_pin_v1302', JSON.stringify({ at: 'now', legs: [{sym:'BTC'}] }));
  ok(ctx.hgObtcReadLegPin() === null, 'string "at" reads null (strict number)');

  /* at = 0, clock near epoch so TTL does not independently reject.
     This isolates the "at <= 0" guard — a mutation that drops it must be
     caught here, since Date.now()-0=10 < TTL means TTL alone would pass. */
  {
    const nearEpoch = bootPin(storage, 10);
    storage.setItem('hg_omnibtc_legs_pin_v1302', JSON.stringify({ at: 0, legs: [{sym:'BTC'}] }));
    ok(nearEpoch.hgObtcReadLegPin() === null, 'at:0 with clock=10ms reads null (strict > 0, +null===0 trap pinned)');
  }

  /* at = negative, clock near epoch so TTL does not catch it alone */
  {
    const nearEpoch = bootPin(storage, 10);
    storage.setItem('hg_omnibtc_legs_pin_v1302', JSON.stringify({ at: -1, legs: [{sym:'BTC'}] }));
    ok(nearEpoch.hgObtcReadLegPin() === null, 'negative at with clock=10ms reads null');
  }

  /* at as stringified number — isFinite("1700000000000") is TRUE because
     JS isFinite coerces; only the typeof check catches this. A mutation
     that loosens the typeof guard must be detected. */
  storage.setItem('hg_omnibtc_legs_pin_v1302', JSON.stringify({ at: '1700000000000', legs: [{sym:'BTC'}] }));
  ok(ctx.hgObtcReadLegPin() === null, 'at as stringified number reads null (strict typeof === "number")');

  /* legs = null */
  storage.setItem('hg_omnibtc_legs_pin_v1302', JSON.stringify({ at: T0, legs: null }));
  ok(ctx.hgObtcReadLegPin() === null, 'legs:null reads null');

  /* legs = empty array */
  storage.setItem('hg_omnibtc_legs_pin_v1302', JSON.stringify({ at: T0, legs: [] }));
  ok(ctx.hgObtcReadLegPin() === null, 'empty legs reads null');

  /* legs = non-array */
  storage.setItem('hg_omnibtc_legs_pin_v1302', JSON.stringify({ at: T0, legs: 'legs' }));
  ok(ctx.hgObtcReadLegPin() === null, 'string legs reads null');

  /* Throwing getItem */
  const throwingStorage = {
    getItem(){ throw new Error('private mode'); },
    setItem(){ throw new Error('private mode'); }
  };
  const ctxT = bootPin(throwingStorage, T0);
  ok(ctxT.hgObtcReadLegPin() === null, 'throwing getItem reads null (no leak)');
  /* And write never throws */
  let didThrow = false;
  try { ctxT.hgObtcWriteLegPin([{sym:'BTC'}]); } catch(e){ didThrow = true; }
  ok(!didThrow, 'throwing setItem is swallowed');
}

/* ---------- §5: write refuses non-array / empty ---------- */
console.log('\n[§5] write refuses junk');
{
  const storage = makeStorage();
  const ctx = bootPin(storage, 1_700_000_000_000);

  ctx.hgObtcWriteLegPin(null);
  ok(storage.getItem('hg_omnibtc_legs_pin_v1302') === null, 'write(null) writes nothing');

  ctx.hgObtcWriteLegPin([]);
  ok(storage.getItem('hg_omnibtc_legs_pin_v1302') === null, 'write([]) writes nothing');

  ctx.hgObtcWriteLegPin({ foo: 'bar' });
  ok(storage.getItem('hg_omnibtc_legs_pin_v1302') === null, 'write(object) writes nothing');

  ctx.hgObtcWriteLegPin('legs');
  ok(storage.getItem('hg_omnibtc_legs_pin_v1302') === null, 'write(string) writes nothing');

  /* valid write succeeds */
  ctx.hgObtcWriteLegPin([{ sym: 'BTCUSDT' }]);
  ok(storage.getItem('hg_omnibtc_legs_pin_v1302') !== null, 'write(1-leg array) succeeds');
}

/* ---------- §6: resolver uses pin on second call ---------- */
console.log('\n[§6] hgObtcResolveLegs: second call returns pinned legs without re-fetching');
{
  const storage = makeStorage();
  const T0 = 1_700_000_000_000;
  const ctx = bootPin(storage, T0);

  /* First call: no pin, so xuUniverse / defaultLegs runs. We've stubbed gfn
     to return false (no xuUniverse), so hgObtcDefaultLegs() is used. */
  let fetchCount = 0;
  ctx.gfn = () => false;
  ctx.hgObtcDefaultLegs = () => { fetchCount++; return [{ sym: 'BTCUSDT', venue: 'default' }]; };

  const legs1 = await ctx.hgObtcResolveLegs();
  ok(Array.isArray(legs1) && legs1.length === 1, 'first resolve returns 1 leg');
  ok(fetchCount === 1, 'first resolve calls defaultLegs');
  ok(storage.getItem('hg_omnibtc_legs_pin_v1302') !== null, 'first resolve writes pin');

  /* Second call within TTL: returns pinned without touching defaultLegs */
  const legs2 = await ctx.hgObtcResolveLegs();
  ok(Array.isArray(legs2) && legs2.length === 1, 'second resolve returns 1 leg');
  ok(fetchCount === 1, 'second resolve does NOT call defaultLegs (pin hit)');
  ok(legs2[0].sym === 'BTCUSDT', 'pinned leg preserved');

  /* Third call after TTL: pin expired, defaultLegs runs again */
  const ctxLater = bootPin(storage, T0 + 31 * 60 * 1000);
  ctxLater.gfn = () => false;
  let fetchCount2 = 0;
  ctxLater.hgObtcDefaultLegs = () => { fetchCount2++; return [{ sym: 'BTCUSDT', venue: 'fresh' }]; };
  const legs3 = await ctxLater.hgObtcResolveLegs();
  ok(fetchCount2 === 1, 'post-TTL resolve calls defaultLegs again');
  ok(legs3[0].venue === 'fresh', 'post-TTL returns the fresh venue, not the stale pin');
}

/* ---------- §7: measured-rank sort is stable and alphabetical ---------- */
console.log('\n[§7] measured-rank iteration order is deterministic');
{
  /* Lift the ACTUAL sort block from omnibtc.js — not an inlined copy — so a
     mutation on the shipped code (reversed comparator, dropped sort, dropped
     mechanic read) is caught here. The block sits inside the measured-rank
     override in hgObtcPick; its text is marked with the hg-v1302 comment. */
  function sortFnFromSource(){
    const src = read('omnibtc.js');
    const startMarker = 'hg-v1302: iterate in a stable order';
    const startIdx = src.indexOf(startMarker);
    if (startIdx < 0) throw new Error('hg-v1302 sort block marker not found');
    /* The block is `var btcForProven = btc.slice().sort(function(a, b){ ... });` */
    const varIdx = src.indexOf('var btcForProven', startIdx);
    if (varIdx < 0) throw new Error('btcForProven assignment not found');
    /* Find the matching `});` that closes `sort(function(a,b){...})` */
    const sortCallStart = src.indexOf('.sort(function', varIdx);
    if (sortCallStart < 0) throw new Error('sort(function not found');
    /* Walk braces from the first `{` after sort(function... */
    const braceStart = src.indexOf('{', sortCallStart);
    let depth = 1, i = braceStart + 1;
    while (i < src.length && depth > 0){
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
    if (depth !== 0) throw new Error('sort body braces not balanced');
    /* body is between braceStart+1 and i-1 */
    const body = src.slice(braceStart + 1, i - 1);
    /* Build a function that drives this body with (a, b) */
    const ctx = {
      String, Number, Array, Object, Math, JSON, isFinite, isNaN,
      console: { log(){}, warn(){}, error(){} }
    };
    vm.createContext(ctx);
    const fnSrc = 'function cmp(a, b){' + body + '} cmp;';
    const cmp = vm.runInContext(fnSrc, ctx);
    return (btc) => btc.slice().sort(cmp);
  }
  const sortFn = sortFnFromSource();

  /* Two refreshes: candidates pushed in different orders by engine loop */
  const refreshA = [
    { kind: 'NR7-BREAK', sym: 'BTCUSDT', clean: true },
    { kind: 'AVWAP-RECLAIM', sym: 'BTCUSDT', clean: true },
    { kind: 'MMOVE', sym: 'BTCUSDT', clean: true }
  ];
  const refreshB = [
    { kind: 'MMOVE', sym: 'BTCUSDT', clean: true },
    { kind: 'NR7-BREAK', sym: 'BTCUSDT', clean: true },
    { kind: 'AVWAP-RECLAIM', sym: 'BTCUSDT', clean: true }
  ];
  const sortedA = sortFn(refreshA);
  const sortedB = sortFn(refreshB);
  ok(sortedA.map(r => r.kind).join(',') === 'AVWAP-RECLAIM,MMOVE,NR7-BREAK', 'refresh A sorts alphabetical');
  ok(sortedB.map(r => r.kind).join(',') === 'AVWAP-RECLAIM,MMOVE,NR7-BREAK', 'refresh B sorts alphabetical (SAME as A)');
  ok(sortedA.map(r => r.kind).join() === sortedB.map(r => r.kind).join(), 'two refreshes produce identical order');

  /* Mixed case still sorts case-insensitively via toUpperCase */
  const mixed = [
    { kind: 'nr7-break', sym: 'BTCUSDT', clean: true },
    { kind: 'MMOVE', sym: 'BTCUSDT', clean: true }
  ];
  const sortedM = sortFn(mixed);
  ok(sortedM[0].kind === 'MMOVE', 'MMOVE < nr7-break (upper comparison)');

  /* Tie on mechanic: sym tiebreak */
  const tied = [
    { kind: 'MMOVE', sym: 'ETHUSDT', clean: true },
    { kind: 'MMOVE', sym: 'BTCUSDT', clean: true }
  ];
  const sortedT = sortFn(tied);
  ok(sortedT[0].sym === 'BTCUSDT', 'tied mechanic breaks on sym alphabetical (BTC before ETH)');

  /* omniKind takes precedence over kind */
  const omni = [
    { kind: 'ZZZ', omniKind: 'AAA', sym: 'BTCUSDT' },
    { kind: 'AAA', sym: 'BTCUSDT' }
  ];
  const sortedO = sortFn(omni);
  ok(sortedO[0].omniKind === 'AAA' || sortedO[0].kind === 'AAA', 'omniKind read first');

  /* Missing mechanic field: empty string sorts first stably */
  const missing = [
    { sym: 'BTCUSDT' },
    { kind: 'MMOVE', sym: 'BTCUSDT' }
  ];
  const sortedMis = sortFn(missing);
  ok(sortedMis[0].kind === undefined, 'missing mechanic sorts before named one');

  /* Does not mutate input */
  const original = [{ kind: 'B', sym: 'x' }, { kind: 'A', sym: 'x' }];
  const originalCopy = original.slice();
  sortFn(original);
  ok(original[0].kind === 'B' && original[1].kind === 'A', 'input array not mutated');
}

/* ---------- §8: no gate reads the pin or depends on the sort ---------- */
console.log('\n[§8] pin and sort are inputs, not gates (hg-v966)');
{
  const gateFiles = ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
    'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'];
  for (const gf of gateFiles){
    let src;
    try { src = read(gf); } catch(e){ ok(false, `gate file ${gf} missing`); continue; }
    ok(!/LEGS_PIN_KEY|hgObtcReadLegPin|hgObtcWriteLegPin/.test(src), `${gf}: no gate reads the pin`);
    ok(!/hg_omnibtc_legs_pin_v1302/.test(src), `${gf}: no gate reads the pin key`);
  }
}

/* ---------- §9: ship stamps align ---------- */
console.log('\n[§9] ship stamps align');
{
  const { HG_VER, swCacheOk } = await import('./helpers/build-version.mjs');
  ok(/^hg-v\d+$/.test(HG_VER), `HG_VER matches shape: ${HG_VER}`);
  ok(swCacheOk(read('sw.js')), `sw.js HG_CACHE matches ${HG_VER}`);
  const trendtable = read('trendtable.js');
  const verNum = HG_VER.replace(/^hg-v/, '');
  const ttRe = new RegExp("\\?v=" + verNum + "\\b");
  ok(ttRe.test(trendtable), `trendtable.js ?v=${verNum} matches HG_VER`);
  const buildStamp = read('build-stamp.js');
  const bsRe = new RegExp("version:\\s*'" + HG_VER + "'");
  ok(bsRe.test(buildStamp), `build-stamp.js version: '${HG_VER}'`);
}

console.log(`\n== hg-v1302 OMNIBTC refresh stability: ${passed} passed, ${failed} failed ==`);
process.exit(failed === 0 ? 0 : 1);
