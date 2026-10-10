#!/usr/bin/env node
/* hg-v1297: OMNIBTC gains the gold-side free-feed and indicator-stack mark
   pattern. hg-v1162-v1167 put hgGoldFreeFeedVerdicts (goldind.js, 26 keys)
   and hgGoldIndicatorReads + hgGoldIndicatorMarks (gold-catalog.js, 18 keys)
   on every gold forward record. OMNIBTC had the pine marks (hg-v1293/v1295)
   and scattered top-level enum fields (macroTilt, trendQuality, etc) but no
   namespaced three-state marks on a reads: bag — so hgFwdReadSplit('OMNIBTC')
   on any BTC-safe free-feed or indicator read returned empty by construction.

   This pack adds nine free: marks (fngExtreme, btcSeason, dxyTrend, tnxTrend,
   realYieldTilt, vixRising, btcdHigh, stables7dPct, newsBlackout) and ten
   ind: marks (adxTrending, dmiWith, bbSqueeze, bbOutside, rsiWith, kerTrend,
   atrExpanding, volAboveMa, tsmomWith, hurstTrending) through the one home
   on OMNIBTC (hgObtcFreeFeedVerdicts, hgObtcIndicatorReads, hgObtcIndicatorMarks).

   Three-state (hg-v989): true WITH / false AGAINST / absent NOT MEASURED.
   Junk is dropped, never coerced (the +null === 0 trap).

   No gate reads any of the nineteen keys — asserted. The ledger carries them
   under reads: via the hg-v1162 seam which hgFwdNormalize has supported since
   that pack (hg-forward.js:336, hgFwdReadsNormalize), measured by the forward
   split out of sample. hg-v966 refuses a new gate on unmeasured evidence. */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
let passed = 0, failed = 0;
function ok(cond, label){
  if (cond){ passed++; console.log('  ok —', label); }
  else { failed++; console.log('  FAIL —', label); }
}
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function bootHelpers(){
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    Math, Date, isFinite, isNaN, parseFloat, parseInt, JSON, Array, Object,
    Number, String, Promise, RegExp, Error, TypeError, setTimeout, clearTimeout
  };
  ctx.window = ctx; ctx.W = ctx; ctx.globalThis = ctx;
  ctx.localStorage = { data: {}, getItem(k){ return this.data[k] || null; },
    setItem(k, v){ this.data[k] = String(v); }, removeItem(k){ delete this.data[k]; } };
  vm.createContext(ctx);
  vm.runInContext(read('indicators.js'), ctx);
  vm.runInContext(read('indicators2.js'), ctx);
  vm.runInContext(read('fixpack14-core.js'), ctx);
  vm.runInContext(read('hg-forward.js'), ctx);
  vm.runInContext(read('news.js'), ctx);
  /* Lift the three helpers out of omnibtc.js and run them in the sandbox,
     per the hg-v1022 technique. hg-v967 refuses to export just to test. */
  const src = read('omnibtc.js');
  const ffStart = src.indexOf('function hgObtcFreeFeedVerdicts');
  const indEnd = src.indexOf('function hgObtcIsBtc');
  if (ffStart < 0 || indEnd < 0 || indEnd <= ffStart){
    throw new Error('helpers block boundaries not found — did omnibtc.js change?');
  }
  const helpers = src.slice(ffStart, indEnd);
  vm.runInContext(helpers, ctx);
  return ctx;
}

/* ------------------------------------------------------------------ */
console.log('== 1) the three helpers are exported on W (one home) ==');
{
  const src = read('omnibtc.js');
  ok(/W\.hgObtcFreeFeedVerdicts\s*=\s*hgObtcFreeFeedVerdicts/.test(src),
    'hgObtcFreeFeedVerdicts exported on W');
  ok(/W\.hgObtcIndicatorReads\s*=\s*hgObtcIndicatorReads/.test(src),
    'hgObtcIndicatorReads exported on W');
  ok(/W\.hgObtcIndicatorMarks\s*=\s*hgObtcIndicatorMarks/.test(src),
    'hgObtcIndicatorMarks exported on W');
}

/* ------------------------------------------------------------------ */
console.log('== 2) hgObtcFreeFeedVerdicts: direction-aware marks flip with dir ==');
{
  const ctx = bootHelpers();
  const base = {
    fng: { v: 85 },
    dom: 60,
    news: { risk: 'low', blackout: false, unchecked: false },
    regime: { dxyTrend: 'RISING', btcdPct: 60, stables: { delta7dPct: 2.5 }, at: Date.now() },
    rotation: { season: 'btc', altPct: 40, at: Date.now() },
    macro: { tnxTrend: 'RISING', realRateHint: 'HEADWIND', vixTrend: 'RISING' }
  };
  const longV = ctx.hgObtcFreeFeedVerdicts(base, 'long', 'BTCUSDT');
  const shortV = ctx.hgObtcFreeFeedVerdicts(base, 'short', 'BTCUSDT');

  /* fngExtreme at F&G=85, long: BIAS S2 blocks greed>=80 fresh long -> true */
  ok(longV['free:fngExtreme'] === true, 'F&G 85 + long → fngExtreme=true (veto fires)');
  ok(shortV['free:fngExtreme'] === false, 'F&G 85 + short → fngExtreme=false (readable, not firing)');
  /* btcSeason: BTC season favours BTC long */
  ok(longV['free:btcSeason'] === true, 'BTC season + long → btcSeason=true');
  ok(shortV['free:btcSeason'] === false, 'BTC season + short → btcSeason=false');
  /* dxyTrend RISING: against long */
  ok(longV['free:dxyTrend'] === false, 'DXY RISING + long → dxyTrend=false (against)');
  ok(shortV['free:dxyTrend'] === true, 'DXY RISING + short → dxyTrend=true (with)');
  /* tnxTrend RISING: against long */
  ok(longV['free:tnxTrend'] === false, 'TNX RISING + long → tnxTrend=false');
  ok(shortV['free:tnxTrend'] === true, 'TNX RISING + short → tnxTrend=true');
  /* realYieldTilt HEADWIND: against long */
  ok(longV['free:realYieldTilt'] === false, 'HEADWIND + long → realYieldTilt=false');
  ok(shortV['free:realYieldTilt'] === true, 'HEADWIND + short → realYieldTilt=true');
  /* btcdHigh 60 > 55: with long, against short */
  ok(longV['free:btcdHigh'] === true, 'BTC.D 60 + long → btcdHigh=true');
  ok(shortV['free:btcdHigh'] === false, 'BTC.D 60 + short → btcdHigh=false');
}

/* ------------------------------------------------------------------ */
console.log('== 3) hgObtcFreeFeedVerdicts: state reads are the same both ways ==');
{
  const ctx = bootHelpers();
  const base = {
    fng: { v: 50 },
    dom: 50,
    news: { risk: 'low', blackout: false, unchecked: false },
    regime: { dxyTrend: 'FLAT', btcdPct: 50, stables: { delta7dPct: 2.0 }, at: Date.now() },
    rotation: { season: 'mixed', altPct: 50, at: Date.now() },
    macro: { tnxTrend: 'FLAT', realRateHint: 'NEUTRAL', vixTrend: 'RISING' }
  };
  const longV = ctx.hgObtcFreeFeedVerdicts(base, 'long', 'BTCUSDT');
  const shortV = ctx.hgObtcFreeFeedVerdicts(base, 'short', 'BTCUSDT');
  /* vixRising: true on RISING both ways */
  ok(longV['free:vixRising'] === true && shortV['free:vixRising'] === true,
    'VIX RISING is true for both long and short (state read)');
  /* stables7dPct 2.0 >= 1.5: true both ways */
  ok(longV['free:stables7dPct'] === true && shortV['free:stables7dPct'] === true,
    'stables +2.0% is true for both long and short (state read)');
  /* newsBlackout: readable low with calendar loaded */
  ok(longV['free:newsBlackout'] === false && shortV['free:newsBlackout'] === false,
    'news low + loaded is false for both (state read)');
}

/* ------------------------------------------------------------------ */
console.log('== 4) hgObtcFreeFeedVerdicts: hg-v989 three-state — junk refused ==');
{
  const ctx = bootHelpers();
  /* every junk case must leave the key ABSENT, never coerced to a boolean */
  const junk = [
    { label: 'bad dir', ctx: { fng: 85 }, dir: 'LONG', expectKey: 'free:fngExtreme' },
    { label: 'bad dir empty', ctx: { fng: 85 }, dir: '', expectKey: 'free:fngExtreme' },
    { label: 'string fng', ctx: { fng: '85' }, dir: 'long', expectKey: 'free:fngExtreme' },
    { label: 'null fng', ctx: { fng: null }, dir: 'long', expectKey: 'free:fngExtreme' },
    { label: 'junk season', ctx: { rotation: { season: 'altseason' } }, dir: 'long', expectKey: 'free:btcSeason' },
    { label: 'mixed season', ctx: { rotation: { season: 'mixed' } }, dir: 'long', expectKey: 'free:btcSeason' },
    { label: 'FLAT dxy', ctx: { regime: { dxyTrend: 'FLAT' } }, dir: 'long', expectKey: 'free:dxyTrend' },
    { label: 'FLAT tnx', ctx: { macro: { tnxTrend: 'FLAT' } }, dir: 'long', expectKey: 'free:tnxTrend' },
    { label: 'NEUTRAL realRate', ctx: { macro: { realRateHint: 'NEUTRAL' } }, dir: 'long', expectKey: 'free:realYieldTilt' },
    { label: 'FLAT vix', ctx: { macro: { vixTrend: 'FLAT' } }, dir: 'long', expectKey: 'free:vixRising' },
    { label: 'BTC.D 50 (neutral band)', ctx: { regime: { btcdPct: 50 } }, dir: 'long', expectKey: 'free:btcdHigh' },
    { label: 'BTC.D 55 (boundary exclusive)', ctx: { regime: { btcdPct: 55 } }, dir: 'long', expectKey: 'free:btcdHigh' },
    { label: 'BTC.D 45 (boundary exclusive)', ctx: { regime: { btcdPct: 45 } }, dir: 'long', expectKey: 'free:btcdHigh' },
    { label: 'stables inside band', ctx: { regime: { stables: { delta7dPct: 0.5 } } }, dir: 'long', expectKey: 'free:stables7dPct' },
    { label: 'news unchecked', ctx: { news: { risk: 'low', blackout: false, unchecked: true } }, dir: 'long', expectKey: 'free:newsBlackout' },
    { label: 'news high (ambiguous)', ctx: { news: { risk: 'high', blackout: false, unchecked: false } }, dir: 'long', expectKey: 'free:newsBlackout' },
    { label: 'string btcdPct', ctx: { regime: { btcdPct: '60' } }, dir: 'long', expectKey: 'free:btcdHigh' },
    { label: 'null regime', ctx: { regime: null }, dir: 'long', expectKey: 'free:dxyTrend' },
    { label: 'null macro', ctx: { macro: null }, dir: 'long', expectKey: 'free:tnxTrend' },
    { label: 'empty ctx', ctx: {}, dir: 'long', expectKey: 'free:fngExtreme' }
  ];
  for (const t of junk){
    const v = ctx.hgObtcFreeFeedVerdicts(t.ctx, t.dir, 'BTCUSDT');
    ok(!(t.expectKey in v), `${t.label} — ${t.expectKey} absent`);
  }
  /* positive sanity: a real BTC long with F&G 85 does set fngExtreme */
  const pos = ctx.hgObtcFreeFeedVerdicts({ fng: 85 }, 'long', 'BTCUSDT');
  ok(pos['free:fngExtreme'] === true, 'positive sanity: F&G 85 + long → fngExtreme=true');
  /* fngVal = 0 is a REAL read, not junk: a reader using `if (fngVal)` would
     silently skip it (the +null === 0 trap in reverse). F&G of 0 is extreme
     fear, which blocks a fresh short per BIAS S2. */
  const zero = ctx.hgObtcFreeFeedVerdicts({ fng: 0 }, 'short', 'BTCUSDT');
  ok(zero['free:fngExtreme'] === true, 'F&G 0 + short → fngExtreme=true (zero is a READ zero, not a null)');
  /* a bad dir of 'LONG' must leave EVERY key absent across the whole set,
     because the function should reject early. A mutation that lets the body
     run with L=false still mis-sets keys that depend on L. */
  const badDir = ctx.hgObtcFreeFeedVerdicts({
    fng: 85, dom: 60,
    news: { risk: 'low', blackout: false, unchecked: false },
    regime: { dxyTrend: 'RISING', btcdPct: 60, stables: { delta7dPct: 2.5 }, at: Date.now() },
    rotation: { season: 'btc', at: Date.now() },
    macro: { tnxTrend: 'RISING', realRateHint: 'HEADWIND', vixTrend: 'RISING' }
  }, 'LONG', 'BTCUSDT');
  ok(Object.keys(badDir).length === 0, "bad dir 'LONG' → entire result is empty (never a partial read)");
  /* positive: TAILWIND is WITH a long */
  const tw = ctx.hgObtcFreeFeedVerdicts({ macro: { realRateHint: 'TAILWIND' } }, 'long', 'BTCUSDT');
  ok(tw['free:realYieldTilt'] === true, 'TAILWIND + long → realYieldTilt=true (favor)');
  const twShort = ctx.hgObtcFreeFeedVerdicts({ macro: { realRateHint: 'TAILWIND' } }, 'short', 'BTCUSDT');
  ok(twShort['free:realYieldTilt'] === false, 'TAILWIND + short → realYieldTilt=false');
  /* FALLING DXY + long: WITH (the mirror of the hg-v2 fixture) */
  const dxyDown = ctx.hgObtcFreeFeedVerdicts({ regime: { dxyTrend: 'FALLING' } }, 'long', 'BTCUSDT');
  ok(dxyDown['free:dxyTrend'] === true, 'DXY FALLING + long → dxyTrend=true (WITH)');
  /* ALT season + short: WITH (BTC short favoured when money leaves BTC) */
  const altShort = ctx.hgObtcFreeFeedVerdicts({ rotation: { season: 'alt' } }, 'short', 'BTCUSDT');
  ok(altShort['free:btcSeason'] === true, 'ALT season + short → btcSeason=true (favored)');
}

/* ------------------------------------------------------------------ */
console.log('== 5) hgObtcIndicatorReads: numeric reads on a real rising tape ==');
{
  const ctx = bootHelpers();
  const rows = Array.from({length: 60}, (_, i) => ({
    t: 1700000000 + i*14400,
    o: 100 + i*0.5,
    h: 101 + i*0.5,
    l: 99 + i*0.5,
    c: 100.5 + i*0.5,
    v: 1000 + Math.sin(i*0.2)*200
  }));
  const ir = ctx.hgObtcIndicatorReads(rows, { tsmomN: 6 });
  ok(ir.n === 60, 'carries bar count');
  ok(typeof ir.adx14 === 'number' && isFinite(ir.adx14), 'adx14 computed');
  ok(typeof ir.rsi14 === 'number' && isFinite(ir.rsi14), 'rsi14 computed');
  ok(typeof ir.ker20 === 'number' && isFinite(ir.ker20),
    'ker20 computed (array-last-element, not a scalar — hg-v955 trap)');
  ok(typeof ir.atr14 === 'number' && isFinite(ir.atr14), 'atr14 computed');
  ok(typeof ir.atr50 === 'number' && isFinite(ir.atr50), 'atr50 computed');
  ok(typeof ir.tsmom === 'number' && isFinite(ir.tsmom), 'tsmom computed');
  ok(typeof ir.volAboveMa === 'boolean', 'volAboveMa is a boolean');
  /* thin tape returns empty object */
  const thin = ctx.hgObtcIndicatorReads(rows.slice(0, 10), {});
  ok(thin.n === 0 || Object.keys(thin).length === 1, 'thin tape (< 30 bars) returns n:0 only');
  const empty = ctx.hgObtcIndicatorReads([], {});
  ok(empty.n === 0 && !('adx14' in empty), 'empty rows returns no reads');
  const nullIn = ctx.hgObtcIndicatorReads(null, {});
  ok(nullIn && nullIn.n === 0, 'null rows returns n:0 object (never throws)');
}

/* ------------------------------------------------------------------ */
console.log('== 6) hgObtcIndicatorMarks: direction-aware marks flip with dir ==');
{
  const ctx = bootHelpers();
  const rows = Array.from({length: 60}, (_, i) => ({
    t: 1700000000 + i*14400, o: 100 + i*0.5, h: 101 + i*0.5, l: 99 + i*0.5, c: 100.5 + i*0.5, v: 1000
  }));
  const ir = ctx.hgObtcIndicatorReads(rows, { tsmomN: 6 });
  const mLong = ctx.hgObtcIndicatorMarks(ir, 'long');
  const mShort = ctx.hgObtcIndicatorMarks(ir, 'short');
  /* on a monotonic rising tape: +DI dominates, RSI > 50, TSMOM > 0, so
     the LONG side reads true on each direction-aware mark (absolute, not
     merely "flips" — a swapped semantic also flips but reads false on long). */
  ok(mLong['ind:dmiWith'] === true, 'rising tape + long → dmiWith=true (absolute, not merely flipped)');
  ok(mShort['ind:dmiWith'] === false, 'rising tape + short → dmiWith=false');
  ok(mLong['ind:rsiWith'] === true, 'rising tape + long → rsiWith=true');
  ok(mShort['ind:rsiWith'] === false, 'rising tape + short → rsiWith=false');
  ok(mLong['ind:tsmomWith'] === true, 'rising tape + long → tsmomWith=true');
  ok(mShort['ind:tsmomWith'] === false, 'rising tape + short → tsmomWith=false');
  /* state reads: identical on both directions */
  for (const k of ['ind:adxTrending','ind:bbSqueeze','ind:bbOutside','ind:kerTrend','ind:atrExpanding','ind:volAboveMa','ind:hurstTrending']){
    if (k in mLong){
      ok(mLong[k] === mShort[k], `${k} is identical on long and short (state read)`);
    }
  }
}

/* ------------------------------------------------------------------ */
console.log('== 7) hgObtcIndicatorMarks: hg-v989 three-state — boundary cases absent ==');
{
  const ctx = bootHelpers();
  /* bad dir refused */
  const m0 = ctx.hgObtcIndicatorMarks({ adx14: 30, rsi14: 60 }, 'LONG');
  ok(Object.keys(m0).length === 0, 'bad dir ("LONG") → empty marks');
  /* ADX in the 20-25 band: absent */
  const m1 = ctx.hgObtcIndicatorMarks({ adx14: 22 }, 'long');
  ok(!('ind:adxTrending' in m1), 'ADX 22 (in 20-25 band) → absent');
  /* RSI exactly 50: absent */
  const m2 = ctx.hgObtcIndicatorMarks({ rsi14: 50 }, 'long');
  ok(!('ind:rsiWith' in m2), 'RSI exactly 50 → absent (no verdict)');
  /* KER in the 0.3-0.6 band: absent */
  const m3 = ctx.hgObtcIndicatorMarks({ ker20: 0.45 }, 'long');
  ok(!('ind:kerTrend' in m3), 'KER 0.45 → absent');
  /* Hurst in the 0.45-0.55 band: absent */
  const m4 = ctx.hgObtcIndicatorMarks({ hurst1d: 0.5 }, 'long');
  ok(!('ind:hurstTrending' in m4), 'Hurst 0.5 → absent');
  /* +DI = -DI exact: absent */
  const m5 = ctx.hgObtcIndicatorMarks({ plusDI: 25, minusDI: 25 }, 'long');
  ok(!('ind:dmiWith' in m5), '+DI = -DI → absent');
  /* ATR14 = ATR50 exact: absent */
  const m6 = ctx.hgObtcIndicatorMarks({ atr14: 1.5, atr50: 1.5 }, 'long');
  ok(!('ind:atrExpanding' in m6), 'ATR14 = ATR50 → absent');
  /* tsmom exactly 0: absent */
  const m7 = ctx.hgObtcIndicatorMarks({ tsmom: 0 }, 'long');
  ok(!('ind:tsmomWith' in m7), 'tsmom exactly 0 → absent');
  /* string reads refused */
  const m8 = ctx.hgObtcIndicatorMarks({ adx14: '30', rsi14: '60' }, 'long');
  ok(Object.keys(m8).length === 0, 'string reads refused (never coerced)');
  /* positive sanity */
  const mOk = ctx.hgObtcIndicatorMarks({ adx14: 30, rsi14: 65 }, 'long');
  ok(mOk['ind:adxTrending'] === true, 'ADX 30 → adxTrending=true');
  ok(mOk['ind:rsiWith'] === true, 'RSI 65 + long → rsiWith=true');
}

/* ------------------------------------------------------------------ */
console.log('== 8) end-to-end: the reads: bag persists through hgFwdRecordScan ==');
{
  const ctx = bootHelpers();
  const bag = {};
  const free = ctx.hgObtcFreeFeedVerdicts({
    fng: { v: 85 }, dom: 60,
    news: { risk: 'low', blackout: false, unchecked: false },
    regime: { dxyTrend: 'RISING', btcdPct: 60, stables: { delta7dPct: 2.5 }, at: Date.now() },
    rotation: { season: 'btc', at: Date.now() },
    macro: { tnxTrend: 'RISING', realRateHint: 'HEADWIND', vixTrend: 'RISING' }
  }, 'long', 'BTCUSDT');
  for (const k in free){ if (free[k] === true || free[k] === false) bag[k] = free[k]; }
  const rows = Array.from({length: 60}, (_, i) => ({
    t: 1700000000 + i*14400, o: 100 + i*0.5, h: 101 + i*0.5, l: 99 + i*0.5, c: 100.5 + i*0.5, v: 1000
  }));
  const ind = ctx.hgObtcIndicatorMarks(ctx.hgObtcIndicatorReads(rows, {}), 'long');
  for (const k in ind){ if (ind[k] === true || ind[k] === false) bag[k] = ind[k]; }

  const rec = {
    tab: 'OMNIBTC', mechanic: 'MMOVE', sym: 'BTCUSD', tf: '4h', dir: 'long',
    entry: 100, stop: 95, t1: 110, barT: 1700000000,
    mark: 99, ticket: true,
    reads: bag
  };
  ctx.hgFwdRecordScan('OMNIBTC', '4h', [rec], { horizonBars: 20 });
  const stored = ctx.hgFwdRecords('OMNIBTC');
  ok(stored.length === 1, 'one record stored');
  const sr = stored[0];
  ok(sr.reads && typeof sr.reads === 'object', 'record carries reads: bag');
  const bagKeys = Object.keys(sr.reads).sort();
  const freeKeys = bagKeys.filter(k => k.startsWith('free:'));
  const indKeys = bagKeys.filter(k => k.startsWith('ind:'));
  ok(freeKeys.length >= 7, `at least 7 free: keys persist (got ${freeKeys.length}: ${freeKeys.join(',')})`);
  ok(indKeys.length >= 4, `at least 4 ind: keys persist (got ${indKeys.length}: ${indKeys.join(',')})`);
  /* each surviving mark is a boolean */
  for (const k of bagKeys){
    ok(sr.reads[k] === true || sr.reads[k] === false, `${k} is strict boolean`);
  }
}

/* ------------------------------------------------------------------ */
console.log('== 9) NO GATE READS free: / ind: marks — 7 files × 19 keys × 2 shapes = 266 empty cells ==');
{
  const gateFiles = [
    'cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
    'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'
  ];
  const keys = [
    'free:fngExtreme','free:btcSeason','free:dxyTrend','free:tnxTrend','free:realYieldTilt',
    'free:vixRising','free:btcdHigh','free:stables7dPct','free:newsBlackout',
    'ind:adxTrending','ind:dmiWith','ind:bbSqueeze','ind:bbOutside','ind:rsiWith',
    'ind:kerTrend','ind:atrExpanding','ind:volAboveMa','ind:tsmomWith','ind:hurstTrending'
  ];
  let empty = 0, total = 0;
  for (const f of gateFiles){
    let body;
    try{ body = read(f); }catch(e){ continue; }
    for (const k of keys){
      total += 2;
      /* reads bag access or direct property read */
      const dot = new RegExp('\\breads\\s*\\.\\s*' + k.replace(':', '\\s*:?\\s*').replace(/\./g, '\\.') + '\\b');
      /* the keys literally contain a colon — grep for the quoted-string form */
      const quoted = new RegExp("['\"]" + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]");
      if (!dot.test(body)) empty++;
      if (!quoted.test(body)) empty++;
    }
  }
  ok(total === 266, `swept ${total} cells (7 files × 19 keys × 2 shapes)`);
  ok(empty === 266, `all ${empty}/266 cells empty: no gate reads any of the nineteen marks`);
}

/* ------------------------------------------------------------------ */
console.log('== 10) the record stamp site assembles the reads: bag and hands it in ==');
{
  const src = read('omnibtc.js');
  ok(/pfReads\.freeFeedVerdicts\s*=\s*hgObtcFreeFeedVerdicts\s*\(\s*ffCtx\s*,/.test(src),
    'pfReads block computes freeFeedVerdicts');
  ok(/var fwdIndReads\s*=\s*hgObtcIndicatorReads\s*\(/.test(src),
    'record block computes indicator reads');
  ok(/var fwdIndMarks\s*=\s*hgObtcIndicatorMarks\s*\(\s*fwdIndReads\s*,\s*pick\.row\.dir\s*\)/.test(src),
    'record block computes indicator marks');
  ok(/var fwdReadsBag\s*=\s*\{\s*\};/.test(src),
    'record block assembles the reads: bag');
  ok(/reads:\s*fwdReadsBag/.test(src),
    'the fwdRow literal carries reads: fwdReadsBag');
  /* strict-boolean filter in the bag assembly (hg-v955 — never pass a non-boolean through) */
  ok(/ff\[kFF\]\s*===\s*true\s*\|\|\s*ff\[kFF\]\s*===\s*false/.test(src),
    'free-feed merge filters to strict booleans only');
  ok(/fwdIndMarks\[kII\]\s*===\s*true\s*\|\|\s*fwdIndMarks\[kII\]\s*===\s*false/.test(src),
    'ind-mark merge filters to strict booleans only');
}

/* ------------------------------------------------------------------ */
console.log('== 11) ship stamps align build / sw / trendtable (read via shared helper, hg-v956) ==');
{
  const { HG_VER, swCacheOk } = await import('./helpers/build-version.mjs');
  const buildStamp = read('build-stamp.js');
  ok(new RegExp("version:\\s*['\"]" + HG_VER + "['\"]").test(buildStamp),
    'build-stamp.js version matches HG_VER (' + HG_VER + ')');
  ok(swCacheOk(read('sw.js')), 'sw.js HG_CACHE matches HG_VER');
}

/* ------------------------------------------------------------------ */
console.log('');
console.log(`== hg-v1297 OMNIBTC free-feeds + indicator stack: ${passed} passed, ${failed} failed ==`);
process.exit(failed ? 1 : 0);
