#!/usr/bin/env node
/* hg-v1299: OMNIBTC gains two more free: marks (btcGoldCorr, curveSlopeTrend)
   and three more ind: marks (sma50With, sma200With, parkHigh) through the
   same hg-v1297 one home. Tenth OMNIBTC improvement ask this cycle; the hg-v1294
   walker still needs its first bake (403 CONNECT on every data route), so what
   doctrine allows is more three-state record-only marks that the forward
   ledger can split on out of sample. hg-v966 refuses an unmeasured gate; these
   ride record-only until the walker measures them. No gate reads any of the
   five new keys (asserted), no setup leaves any board.

   Each new mark is three-state (hg-v989: true WITH / false AGAINST / absent
   NOT MEASURED). Direction-aware marks flip with pick.row.dir; state reads
   (btcGoldCorr, curveSlopeTrend, parkHigh — a regime is not a side, hg-v993)
   read the same on long and short. Nothing is coerced (+null === 0 trap).

   Behavioural pass drives the five new marks under the real helpers lifted
   from omnibtc.js (hg-v967: no re-implementation). Mutation targets include
   the strict-inequality boundaries (hg-v989), the strict string match on
   curveSlopeTrend, and the Parkinson own-window exclusion (hg-v1158 trap). */
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

/* Build a sloped tape — a steady drift with ATR-sized high/low wicks. */
function makeTape(n, trend){
  trend = trend || 0.0005; /* +0.05% / bar default (slow bull) */
  const rows = [];
  let c = 100;
  for (let i = 0; i < n; i++){
    const o = c;
    c = c * (1 + trend);
    const h = Math.max(o, c) * 1.001;
    const l = Math.min(o, c) * 0.999;
    rows.push({ t: 1_700_000_000_000 + i * 240 * 60 * 1000, o, h, l, c, v: 1000 + i });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
console.log('== 1) hg-v1297 count was 19, hg-v1299 is 24 (ONE HOME, hg-v949) ==');
{
  const src = read('omnibtc.js');
  /* free: key count via regex */
  const freeKeys = Array.from(new Set((src.match(/out\['free:(\w+)'\]/g) || []).map(s => s.match(/free:(\w+)/)[1])));
  const indKeys = Array.from(new Set((src.match(/out\['ind:(\w+)'\]/g) || []).map(s => s.match(/ind:(\w+)/)[1])));
  ok(freeKeys.length === 12, 'omnibtc.js emits exactly 12 free: keys (was 11 before hg-v1301 added mempoolFeeHigh)');
  ok(indKeys.length === 13, 'omnibtc.js emits exactly 13 ind: keys (was 10 before hg-v1299)');
  ok(freeKeys.includes('btcGoldCorr'), 'free:btcGoldCorr emitted');
  ok(freeKeys.includes('curveSlopeTrend'), 'free:curveSlopeTrend emitted');
  ok(indKeys.includes('sma50With'), 'ind:sma50With emitted');
  ok(indKeys.includes('sma200With'), 'ind:sma200With emitted');
  ok(indKeys.includes('parkHigh'), 'ind:parkHigh emitted');
  /* 12 + 13 = 25, inside the 96 cap by 71 (plus 13 pine marks = 38 per record) */
  ok(12 + 13 === 25, '25 total free:/ind: keys, inside 96 cap');
}

/* ------------------------------------------------------------------ */
console.log('== 2) free:btcGoldCorr — state read with +/-0.30 band (hg-v989) ==');
{
  const ctx = bootHelpers();
  const fv = ctx.hgObtcFreeFeedVerdicts;
  const base = { macro: { goldBtcCorr20: 0.50 } };
  /* positive beyond +0.30 reads true */
  ok(fv(base, 'long', 'BTCUSDT')['free:btcGoldCorr'] === true, 'corr=0.50 long reads true');
  ok(fv(base, 'short', 'BTCUSDT')['free:btcGoldCorr'] === true, 'corr=0.50 short reads true (regime, not a side)');
  /* negative beyond -0.30 reads false */
  const neg = { macro: { goldBtcCorr20: -0.50 } };
  ok(fv(neg, 'long', 'BTCUSDT')['free:btcGoldCorr'] === false, 'corr=-0.50 long reads false');
  ok(fv(neg, 'short', 'BTCUSDT')['free:btcGoldCorr'] === false, 'corr=-0.50 short reads false (regime, not a side)');
  /* inside band reads absent */
  const mid = { macro: { goldBtcCorr20: 0.15 } };
  ok(!('free:btcGoldCorr' in fv(mid, 'long', 'BTCUSDT')), 'corr=0.15 reads absent');
  const midNeg = { macro: { goldBtcCorr20: -0.20 } };
  ok(!('free:btcGoldCorr' in fv(midNeg, 'long', 'BTCUSDT')), 'corr=-0.20 reads absent');
  /* boundary exact-equal is at the inclusive bar (>= / <=) so +0.30 and -0.30 read true/false */
  const boundHi = { macro: { goldBtcCorr20: 0.30 } };
  ok(fv(boundHi, 'long', 'BTCUSDT')['free:btcGoldCorr'] === true, 'corr=+0.30 exact reads true (>=)');
  const boundLo = { macro: { goldBtcCorr20: -0.30 } };
  ok(fv(boundLo, 'long', 'BTCUSDT')['free:btcGoldCorr'] === false, 'corr=-0.30 exact reads false (<=)');
  /* junk cases, each absent */
  ok(!('free:btcGoldCorr' in fv({}, 'long', 'BTCUSDT')), 'no macro reads absent');
  ok(!('free:btcGoldCorr' in fv({ macro: {} }, 'long', 'BTCUSDT')), 'macro without goldBtcCorr20 reads absent');
  ok(!('free:btcGoldCorr' in fv({ macro: { goldBtcCorr20: null } }, 'long', 'BTCUSDT')), 'null reads absent (not 0)');
  ok(!('free:btcGoldCorr' in fv({ macro: { goldBtcCorr20: '0.50' } }, 'long', 'BTCUSDT')), 'string reads absent (not coerced)');
  ok(!('free:btcGoldCorr' in fv({ macro: { goldBtcCorr20: NaN } }, 'long', 'BTCUSDT')), 'NaN reads absent');
  ok(!('free:btcGoldCorr' in fv({ macro: { goldBtcCorr20: Infinity } }, 'long', 'BTCUSDT')), 'Infinity reads absent');
}

/* ------------------------------------------------------------------ */
console.log('== 3) free:curveSlopeTrend — strict string match on STEEPENING/FLATTENING ==');
{
  const ctx = bootHelpers();
  const fv = ctx.hgObtcFreeFeedVerdicts;
  /* STEEPENING reads true both ways */
  const steep = { macro: { curveSlopeTrend: 'STEEPENING' } };
  ok(fv(steep, 'long', 'BTCUSDT')['free:curveSlopeTrend'] === true, 'STEEPENING long reads true');
  ok(fv(steep, 'short', 'BTCUSDT')['free:curveSlopeTrend'] === true, 'STEEPENING short reads true (regime)');
  /* FLATTENING reads false both ways */
  const flat = { macro: { curveSlopeTrend: 'FLATTENING' } };
  ok(fv(flat, 'long', 'BTCUSDT')['free:curveSlopeTrend'] === false, 'FLATTENING long reads false');
  ok(fv(flat, 'short', 'BTCUSDT')['free:curveSlopeTrend'] === false, 'FLATTENING short reads false (regime)');
  /* FLAT, junk, lower-case, null, number all read absent */
  ok(!('free:curveSlopeTrend' in fv({ macro: { curveSlopeTrend: 'FLAT' } }, 'long', 'BTCUSDT')), 'FLAT reads absent');
  ok(!('free:curveSlopeTrend' in fv({ macro: { curveSlopeTrend: 'steepening' } }, 'long', 'BTCUSDT')), 'lower-case reads absent');
  ok(!('free:curveSlopeTrend' in fv({ macro: { curveSlopeTrend: 'STEEP' } }, 'long', 'BTCUSDT')), 'partial match reads absent');
  ok(!('free:curveSlopeTrend' in fv({ macro: { curveSlopeTrend: null } }, 'long', 'BTCUSDT')), 'null reads absent');
  ok(!('free:curveSlopeTrend' in fv({ macro: { curveSlopeTrend: 1 } }, 'long', 'BTCUSDT')), 'number reads absent');
  ok(!('free:curveSlopeTrend' in fv({ macro: {} }, 'long', 'BTCUSDT')), 'missing reads absent');
}

/* ------------------------------------------------------------------ */
console.log('== 4) ind:sma50With and sma200With — direction-aware trend filter ==');
{
  const ctx = bootHelpers();
  /* 200-bar steady uptrend tape — close well above both SMAs on last bar */
  const rowsUp = makeTape(220, 0.001);
  const irUp = ctx.hgObtcIndicatorReads(rowsUp, {});
  ok(typeof irUp.sma50 === 'number' && isFinite(irUp.sma50), 'sma50 computed on 220-bar tape');
  ok(typeof irUp.sma200 === 'number' && isFinite(irUp.sma200), 'sma200 computed on 220-bar tape');
  ok(typeof irUp.bbClose === 'number' && isFinite(irUp.bbClose), 'bbClose computed (shared with Bollinger)');
  ok(irUp.bbClose > irUp.sma50, 'uptrend: close > SMA50');
  ok(irUp.bbClose > irUp.sma200, 'uptrend: close > SMA200');
  const marksLong = ctx.hgObtcIndicatorMarks(irUp, 'long');
  const marksShort = ctx.hgObtcIndicatorMarks(irUp, 'short');
  ok(marksLong['ind:sma50With'] === true, 'uptrend long: sma50With true');
  ok(marksShort['ind:sma50With'] === false, 'uptrend short: sma50With false (mirror)');
  ok(marksLong['ind:sma200With'] === true, 'uptrend long: sma200With true');
  ok(marksShort['ind:sma200With'] === false, 'uptrend short: sma200With false (mirror)');
  /* 200-bar downtrend: close well below both */
  const rowsDn = makeTape(220, -0.001);
  const irDn = ctx.hgObtcIndicatorReads(rowsDn, {});
  const marksDnLong = ctx.hgObtcIndicatorMarks(irDn, 'long');
  ok(marksDnLong['ind:sma50With'] === false, 'downtrend long: sma50With false');
  ok(marksDnLong['ind:sma200With'] === false, 'downtrend long: sma200With false');
  /* under 50 bars: no sma50, no mark */
  const rowsThin = makeTape(45, 0.001);
  const irThin = ctx.hgObtcIndicatorReads(rowsThin, {});
  ok(!('sma50' in irThin) || typeof irThin.sma50 !== 'number', 'under 50 bars: no sma50 read');
  const marksThin = ctx.hgObtcIndicatorMarks(irThin, 'long');
  ok(!('ind:sma50With' in marksThin), 'under 50 bars: no sma50With mark');
  ok(!('ind:sma200With' in marksThin), 'under 50 bars: no sma200With mark');
  /* under 200 bars: sma50 but no sma200 */
  const rows100 = makeTape(120, 0.001);
  const ir100 = ctx.hgObtcIndicatorReads(rows100, {});
  ok(typeof ir100.sma50 === 'number' && isFinite(ir100.sma50), '120 bars: sma50 computed');
  ok(!('sma200' in ir100) || typeof ir100.sma200 !== 'number', '120 bars: no sma200');
  const marks100 = ctx.hgObtcIndicatorMarks(ir100, 'long');
  ok(marks100['ind:sma50With'] === true, '120 bars: sma50With true');
  ok(!('ind:sma200With' in marks100), '120 bars: no sma200With mark');
  /* exact-equal boundary: craft a tape where close exactly equals SMA50 */
  const flatRows = [];
  for (let i = 0; i < 60; i++){
    flatRows.push({ t: 1_700_000_000_000 + i*60*1000, o: 100, h: 100.1, l: 99.9, c: 100, v: 100 });
  }
  const irFlat = ctx.hgObtcIndicatorReads(flatRows, {});
  ok(irFlat.sma50 === 100 && irFlat.bbClose === 100, 'flat tape: close equals SMA50');
  const marksFlat = ctx.hgObtcIndicatorMarks(irFlat, 'long');
  ok(!('ind:sma50With' in marksFlat), 'exact equal: sma50With absent (hg-v989 boundary)');
}

/* ------------------------------------------------------------------ */
console.log('== 5) ind:parkHigh — Parkinson vs 100-window median (hg-v1158 own-window trap) ==');
{
  const ctx = bootHelpers();
  /* 150 bars with widening wicks over time -- recent 20 bars have larger ranges
     than earlier 20 bars, so parkinson20 at the end > median of earlier 20-bar windows */
  const rows = [];
  for (let i = 0; i < 150; i++){
    const wick = 0.001 + (i / 150) * 0.01; /* 0.1% to ~1.1% wick over the sweep */
    const c = 100 + i * 0.01;
    rows.push({ t: 1_700_000_000_000 + i*60*1000, o: c, h: c * (1 + wick), l: c * (1 - wick), c, v: 1000 });
  }
  const ir = ctx.hgObtcIndicatorReads(rows, {});
  ok(typeof ir.park20 === 'number' && isFinite(ir.park20), 'park20 computed on 150-bar tape');
  ok(typeof ir.park20Median === 'number' && isFinite(ir.park20Median), 'park20Median computed from earlier windows');
  ok(ir.park20 > ir.park20Median, 'widening wicks: current park20 > median (HIGH vol regime)');
  const marks = ctx.hgObtcIndicatorMarks(ir, 'long');
  ok(marks['ind:parkHigh'] === true, 'widening wicks: parkHigh true');
  const marksShort = ctx.hgObtcIndicatorMarks(ir, 'short');
  ok(marksShort['ind:parkHigh'] === true, 'widening wicks short: parkHigh true (regime, hg-v993)');
  /* narrowing wicks: parkinson falls to below median */
  const rowsNarrow = [];
  for (let i = 0; i < 150; i++){
    const wick = 0.01 - (i / 150) * 0.009; /* 1% down to ~0.1% */
    const c = 100 + i * 0.01;
    rowsNarrow.push({ t: 1_700_000_000_000 + i*60*1000, o: c, h: c * (1 + wick), l: c * (1 - wick), c, v: 1000 });
  }
  const irN = ctx.hgObtcIndicatorReads(rowsNarrow, {});
  const marksN = ctx.hgObtcIndicatorMarks(irN, 'long');
  ok(irN.park20 < irN.park20Median, 'narrowing wicks: park20 < median');
  ok(marksN['ind:parkHigh'] === false, 'narrowing wicks: parkHigh false');
  /* under 50 bars: no park20 read */
  const rowsThin = makeTape(45);
  const irThin = ctx.hgObtcIndicatorReads(rowsThin, {});
  ok(!('park20' in irThin) || typeof irThin.park20 !== 'number', 'under 50 bars: no park20');
  const marksThin = ctx.hgObtcIndicatorMarks(irThin, 'long');
  ok(!('ind:parkHigh' in marksThin), 'under 50 bars: no parkHigh mark');
  /* identical steady wicks: parkinson stays flat so last == median within rounding */
  const rowsFlat = [];
  for (let i = 0; i < 150; i++){
    rowsFlat.push({ t: 1_700_000_000_000 + i*60*1000, o: 100, h: 100.5, l: 99.5, c: 100, v: 1000 });
  }
  const irFlat = ctx.hgObtcIndicatorReads(rowsFlat, {});
  ok(isFinite(irFlat.park20) && isFinite(irFlat.park20Median), 'flat tape: both park20 and median are finite');
  ok(Math.abs(irFlat.park20 - irFlat.park20Median) < 1e-10, 'flat tape: park20 equals median (within rounding)');
  const marksFlat = ctx.hgObtcIndicatorMarks(irFlat, 'long');
  /* a tie reads absent -- a boundary is not a regime (strict inequality) */
  ok(!('ind:parkHigh' in marksFlat), 'flat tape: parkHigh absent (hg-v989 strict > / <)');

  /* hg-v1158 trap: the median must NEVER include its own window reading.
     A behavioural test cannot distinguish ".slice(0, -1)" from ".slice()"
     on tapes where the last reading is far from the median -- a monotonically
     rising series picks up one extra point which doesn't flip the sign. The
     text pin (hg-v956) proves the own-window exclusion is kept at the source. */
  const srcText = read('omnibtc.js');
  ok(/parkSeries\.slice\(0,\s*-1\)/.test(srcText),
    'parkinson median excludes its own window (parkSeries.slice(0, -1), hg-v1158)');
}

/* ------------------------------------------------------------------ */
console.log('== 6) hg-v1297/v1299/v1301 doctrine comment stamps 12 free + 13 ind (self-check) ==');
{
  const src = read('omnibtc.js');
  ok(/Twelve three-state free: marks/.test(src), 'doctrine says twelve free marks (was eleven before hg-v1301)');
  ok(/thirteen\s+three-state ind: marks/.test(src), 'doctrine says thirteen ind marks');
  ok(/twenty-five keys/.test(src), 'doctrine says twenty-five keys total (hg-v1301)');
  ok(/hg-v1299\s+BTC-gold corr/.test(src), 'doctrine names hg-v1299 BTC-gold corr');
  ok(/hg-v1299\s+SMA50 \/\s+SMA200 \/\s+Parkinson20/.test(src), 'doctrine names hg-v1299 SMA/Parkinson');
}

/* ------------------------------------------------------------------ */
console.log('== 7) NO GATE READS the five new keys ==');
{
  const gateFiles = ['cryptogates.js', 'engine.js', 'plans.js', 'hg-gates.js',
    'hg-setup-core.js', 'hg-perfect-setup.js', 'setup-stack.js'];
  const keys = ['free:btcGoldCorr','free:curveSlopeTrend','ind:sma50With','ind:sma200With','ind:parkHigh'];
  let empty = 0, total = 0;
  for (const f of gateFiles){
    let body;
    try{ body = read(f); }catch(e){ continue; }
    for (const k of keys){
      total += 2;
      const dot = new RegExp('\\breads\\s*\\.\\s*' + k.replace(':', '\\s*:?\\s*').replace(/\./g, '\\.') + '\\b');
      const quoted = new RegExp("['\"]" + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "['\"]");
      if (!dot.test(body)) empty++;
      if (!quoted.test(body)) empty++;
    }
  }
  ok(total === 70, `swept ${total} cells (7 files × 5 new keys × 2 shapes)`);
  ok(empty === 70, `all ${empty}/70 cells empty: no gate reads any of the five new marks`);
}

/* ------------------------------------------------------------------ */
console.log('== 8) ship stamps align (hg-v956, read through shared helper) ==');
{
  const { HG_VER, swCacheOk } = await import('./helpers/build-version.mjs');
  ok(/^hg-v\d+$/.test(HG_VER), `HG_VER ${HG_VER} has correct shape`);
  const sw = read('sw.js');
  ok(swCacheOk(sw), `sw.js HG_CACHE matches ${HG_VER}`);
  const trend = read('trendtable.js');
  const numericBuild = (HG_VER.match(/\d+$/) || [])[0];
  const trendVer = (trend.match(/\?v=(\d+)/) || [])[1];
  ok(numericBuild === trendVer, `build numeric ${numericBuild} === trend v=${trendVer}`);
}

console.log(`\n== hg-v1299 OMNIBTC marks: ${passed} passed, ${failed} failed ==`);
process.exit(failed === 0 ? 0 : 1);
