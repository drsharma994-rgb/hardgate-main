#!/usr/bin/env node
/* HARDGATE hg-v1203: BPR Pine port — the twenty-third record-only gold layer,
   appended after the hg-v1173 formation family (QQE, Squeeze, Weekly AVWAP,
   Kaufman Efficiency) that was ported ahead of it on main.
   Balanced Price Range = overlap of a bull three-bar FVG and a bear three-bar
   FVG within a lookback window. The overlap is a shelf (institutional pivot).
   The port fires ONLY on the last closed bar when the tape reclaims the
   shelf from the opposite side:
     - long: prev close above shelf.top, last bar wicks into the shelf and
       closes back above with a bullish body (stop = shelf.bottom - 0.15*ATR)
     - short: mirror (stop = shelf.top + 0.15*ATR)
   DIFFERENT from the hg-v1164 Donchian port (price position in the recent
   range) and from the hg-v1167 CCI port (statistical overbought/oversold):
   this reads a structural overlap of two liquidity gaps. Record-only,
   three-state state read in pineGoldLayerStates: close above the latest
   shelf's top is 'long', below its bottom is 'short', inside is NEITHER.
   Nothing scores on it; no gate module names a 'pine:bprWith' mark. */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function assert(cond, msg){ if (!cond){ console.log('ASSERT ' + msg); process.exit(1); } console.log('ok  ' + msg); }

const BASE = ['indicators.js', 'indicators2.js', 'pinegoldmath.js'];
function loadModules(files){
  const sb = { console, Date, Math, JSON, Object, Array, Promise, isFinite, isNaN, parseInt, parseFloat, Error, TypeError };
  sb.window = sb; sb.self = sb; sb.G = sb;
  for (const f of files) vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
  return sb;
}

/* ====================================================================
   § 1 pinegoldmath.js: BPR port and series helper exist and are wired
   ==================================================================== */
console.log('== 1) BPR port, series helper, table entry, state read ==');
{
  const W = loadModules(BASE);
  assert(typeof W.pineGoldBpr === 'function', 'pineGoldBpr is exported');
  assert(typeof W.pineGoldBprShelves === 'function', 'pineGoldBprShelves is exported');
  const T = W.PINE_GOLD_RECORD_LAYERS;
  assert(T.length === 27, 'twenty-seven record-only layers since hg-v1220 — HalfTrend / Range Filter / NW Envelope follow OTE (' + T.length + ')');
  const b = T[22];
  assert(b && b.id === 'bpr', 'BPR stays at position 22');
  assert(T[23] && T[23].id === 'ote' && T[23].fn === 'pineGoldOte' && T[23].twin === null, 'OTE 0.705 is the last record-only layer and names no twin');
  assert(b.fn === 'pineGoldBpr', 'the registry names the exported function');
  assert(b.twin === null, 'BPR names no OMNIGOLD twin — the Balanced Price Range mechanic is not a registered OMNIGOLD mechanic (hg-v943: no loose analogies)');
  assert(b.opts && b.opts.lookback === 20 && b.opts.minGapAtr === 0.10,
    'the default options are lookback 20 bars and minGapAtr 0.10 (the ATR fraction a three-bar gap must clear to count as a shelf)');
  /* the majority mark keeps its hg-v1165 population */
  assert(W.PINE_GOLD_MAJORITY_IDS.indexOf('bpr') < 0 && W.PINE_GOLD_MAJORITY_IDS.indexOf('ote') < 0,
    'BPR and OTE do NOT join the majority — the mark keeps its hg-v1165 five-layer population');
}

/* ====================================================================
   § 2 pgrBprShelves: FVG detection and overlap arithmetic
   ==================================================================== */
console.log('== 2) BPR shelves: three-bar FVG detection, bull+bear overlap ==');
{
  const W = loadModules(BASE);
  /* a dead-flat tape produces no shelf */
  const flat = Array.from({length: 40}, (_, i) => ({t:i*900, o:2400, h:2400, l:2400, c:2400}));
  const sF = W.pineGoldBprShelves(flat, 20, 0.10);
  assert(Array.isArray(sF) && sF.length === 0, 'a dead-flat tape produces no shelf');
  /* a sparsely populated tape (< 6 bars) returns an empty array, never throws */
  assert(W.pineGoldBprShelves([], 20, 0.10).length === 0, 'empty rows returns an empty list, never a throw');
  assert(W.pineGoldBprShelves(flat.slice(0, 5), 20, 0.10).length === 0, 'under 6 bars returns an empty list, never a throw');
  /* build a tape with one bull FVG and one bear FVG that overlap */
  function craftOverlap(){
    const rows = [];
    let x = 2400;
    /* 20 quiet bars to build ATR */
    for (let i = 0; i < 20; i++){ rows.push({t:i*900, o:x, h:x+0.5, l:x-0.5, c:x+0.1}); x += 0.05; }
    /* a bear impulse: c0 at 2410 (low 2409), c1 is an impulse that closes well below (close < open), c2 at 2395 (high 2396).
       bear gap wants: c0.low > c2.high AND c1 close < c1 open */
    rows.push({t:20*900, o:2412, h:2413, l:2409, c:2410});
    rows.push({t:21*900, o:2410, h:2411, l:2395, c:2396});
    rows.push({t:22*900, o:2395, h:2396, l:2392, c:2394});
    /* 2 cooling bars */
    rows.push({t:23*900, o:2394, h:2395, l:2393, c:2394});
    rows.push({t:24*900, o:2394, h:2395, l:2393, c:2395});
    /* a bull impulse: c0 at 2395, c1 is impulse that closes well above, c2 at 2410.
       bull gap wants: c2.low > c0.high AND c1 close > c1 open */
    rows.push({t:25*900, o:2395, h:2396, l:2393, c:2395});
    rows.push({t:26*900, o:2396, h:2411, l:2395, c:2410});
    rows.push({t:27*900, o:2410, h:2412, l:2409, c:2411});
    /* 2 cooling bars */
    rows.push({t:28*900, o:2411, h:2412, l:2410, c:2411});
    rows.push({t:29*900, o:2411, h:2412, l:2410, c:2411});
    return rows;
  }
  const tape = craftOverlap();
  const S = W.pineGoldBprShelves(tape, 20, 0.10);
  assert(S.length >= 1, 'a tape with one bull FVG and one bear FVG at overlapping levels produces at least one shelf (' + S.length + ')');
  const shelf = S[0];
  assert(isFinite(shelf.top) && isFinite(shelf.bottom) && shelf.top > shelf.bottom,
    'the shelf has a readable top and bottom with top > bottom (' + shelf.bottom.toFixed(2) + ' .. ' + shelf.top.toFixed(2) + ')');
  assert(shelf.mid === (shelf.top + shelf.bottom) / 2 && isFinite(shelf.mid),
    'the shelf mid is the midpoint of top and bottom (not derived from anything else)');
  assert(shelf.size === shelf.top - shelf.bottom,
    'the shelf size is top minus bottom (not an ATR multiple)');
  assert(isFinite(shelf.formedBarIndex) && shelf.formedBarIndex >= 0,
    'the shelf carries the bar index it formed on (' + shelf.formedBarIndex + ')');
  /* with no ATR helper the shelves helper returns no shelves (fails open) */
  const WA = loadModules(BASE);
  WA.atr = null; WA.pineAtr = null;
  const sNoAtr = WA.pineGoldBprShelves(tape, 20, 0.10);
  assert(Array.isArray(sNoAtr) && sNoAtr.length === 0,
    'with no ATR helper the shelves helper returns no shelves — a feed with no ATR is not a shelf (hg-v966: a thin feed is not a weight)');
}

/* ====================================================================
   § 3 pineGoldBpr: the port fires only on the last closed bar reclaim
   ==================================================================== */
console.log('== 3) BPR port: last-bar reclaim rules, strict side guards ==');
{
  const W = loadModules(BASE);
  /* craft a shelf then a reclaim-from-above on the last bar */
  function craftLongReclaim(){
    const rows = [];
    let x = 2400;
    for (let i = 0; i < 20; i++){ rows.push({t:i*900, o:x, h:x+0.5, l:x-0.5, c:x+0.1}); x += 0.05; }
    /* bear impulse down to form a bear FVG */
    rows.push({t:20*900, o:2412, h:2413, l:2409, c:2410});
    rows.push({t:21*900, o:2410, h:2411, l:2395, c:2396});
    rows.push({t:22*900, o:2395, h:2396, l:2392, c:2394});
    rows.push({t:23*900, o:2394, h:2395, l:2393, c:2394});
    rows.push({t:24*900, o:2394, h:2395, l:2393, c:2395});
    /* bull impulse up to form the bull FVG that overlaps the earlier bear FVG */
    rows.push({t:25*900, o:2395, h:2396, l:2393, c:2395});
    rows.push({t:26*900, o:2396, h:2411, l:2395, c:2410});
    rows.push({t:27*900, o:2410, h:2412, l:2409, c:2411});
    /* 3 bars holding above the shelf, so prev close > shelf.top */
    rows.push({t:28*900, o:2411, h:2412, l:2410, c:2411});
    rows.push({t:29*900, o:2411, h:2412, l:2410, c:2411});
    rows.push({t:30*900, o:2411, h:2412, l:2410, c:2411});
    /* the reclaim bar: wicks into the shelf, closes above with a bullish body */
    rows.push({t:31*900, o:2411, h:2412, l:2404, c:2411.5});
    return rows;
  }
  const longTape = craftLongReclaim();
  const shelves = W.pineGoldBprShelves(longTape, 20, 0.10);
  assert(shelves.length >= 1, 'the long-reclaim tape builds at least one shelf as a precondition (' + shelves.length + ')');
  const r = W.pineGoldBpr(longTape, { lookback: 20, minGapAtr: 0.10 });
  assert(r && r.dir === 'long', 'a reclaim from above fires a LONG (' + (r ? r.dir : 'null') + ')');
  assert(isFinite(r.entry) && isFinite(r.stop) && r.stop < r.entry,
    'a long carries entry and stop with stop below entry (' + r.stop.toFixed(2) + ' < ' + r.entry.toFixed(2) + ')');
  /* mirror: a reclaim from below fires a short */
  function craftShortReclaim(){
    const rows = [];
    let x = 2400;
    for (let i = 0; i < 20; i++){ rows.push({t:i*900, o:x, h:x+0.5, l:x-0.5, c:x-0.1}); x -= 0.05; }
    /* bull impulse up */
    rows.push({t:20*900, o:2388, h:2391, l:2387, c:2390});
    rows.push({t:21*900, o:2390, h:2405, l:2389, c:2404});
    rows.push({t:22*900, o:2405, h:2408, l:2404, c:2406});
    rows.push({t:23*900, o:2406, h:2407, l:2405, c:2406});
    rows.push({t:24*900, o:2406, h:2407, l:2405, c:2406});
    /* bear impulse down to form the overlapping bear FVG */
    rows.push({t:25*900, o:2406, h:2407, l:2404, c:2405});
    rows.push({t:26*900, o:2404, h:2405, l:2389, c:2390});
    rows.push({t:27*900, o:2390, h:2391, l:2387, c:2388});
    /* 3 bars holding below the shelf */
    rows.push({t:28*900, o:2388, h:2389, l:2387, c:2388});
    rows.push({t:29*900, o:2388, h:2389, l:2387, c:2388});
    rows.push({t:30*900, o:2388, h:2389, l:2387, c:2388});
    /* the reclaim bar: wicks up into the shelf, closes back below with a bearish body */
    rows.push({t:31*900, o:2388, h:2396, l:2387, c:2387.5});
    return rows;
  }
  const shortTape = craftShortReclaim();
  const rs = W.pineGoldBpr(shortTape, { lookback: 20, minGapAtr: 0.10 });
  assert(rs && rs.dir === 'short', 'a reclaim from below fires a SHORT (' + (rs ? rs.dir : 'null') + ')');
  assert(isFinite(rs.entry) && isFinite(rs.stop) && rs.stop > rs.entry,
    'a short carries entry and stop with stop above entry (' + rs.stop.toFixed(2) + ' > ' + rs.entry.toFixed(2) + ')');
}

/* ====================================================================
   § 4 BPR port: failure modes — no false signal
   ==================================================================== */
console.log('== 4) BPR port: failure modes (no shelf, inside shelf, same-bar formation) ==');
{
  const W = loadModules(BASE);
  /* a dead-flat tape fires nothing */
  const flat = Array.from({length: 40}, (_, i) => ({t:i*900, o:2400, h:2400, l:2400, c:2400}));
  const r0 = W.pineGoldBpr(flat, { lookback: 20, minGapAtr: 0.10 });
  assert(r0 && r0.dir === null, 'a dead-flat tape fires NO signal — a feed with no gaps is not a BPR');
  /* a sparse tape returns no signal, never throws */
  const r1 = W.pineGoldBpr([], { lookback: 20, minGapAtr: 0.10 });
  assert(r1 && r1.dir === null, 'empty rows return no signal, never a throw');
  const r2 = W.pineGoldBpr(flat.slice(0, 5), { lookback: 20, minGapAtr: 0.10 });
  assert(r2 && r2.dir === null, 'under 6 bars returns no signal, never a throw');
  /* a tape with a shelf formed on the last bar does not fire (the imbalance
     has not resolved yet, formedBarIndex === i-1 is skipped). FLAT warm-up
     so the only FVGs are the two I craft and no transition-into-impulse
     FVGs sneak in. */
  function craftSameBarShelf(){
    const rows = [];
    for (let i = 0; i < 18; i++) rows.push({t:i*900, o:2400, h:2400.5, l:2399.5, c:2400});
    rows.push({t:18*900, o:2400, h:2402, l:2398, c:2400});
    rows.push({t:19*900, o:2400, h:2401, l:2390, c:2391});
    rows.push({t:20*900, o:2391, h:2392, l:2390, c:2391});
    rows.push({t:21*900, o:2391, h:2392, l:2390, c:2391});
    rows.push({t:22*900, o:2391, h:2402, l:2390, c:2401});
    rows.push({t:23*900, o:2401, h:2402, l:2400, c:2401});
    return rows;
  }
  const sameBar = craftSameBarShelf();
  const sSame = W.pineGoldBprShelves(sameBar, 20, 0.10);
  assert(sSame.length >= 1 && sSame[sSame.length - 1].formedBarIndex === sameBar.length - 2,
    'the same-bar fixture builds a shelf whose formedBarIndex === last-closed-bar-minus-one (' + (sSame.length ? sSame[sSame.length - 1].formedBarIndex : '-') + ' vs ' + (sameBar.length - 2) + ')');
  const r3 = W.pineGoldBpr(sameBar, { lookback: 20, minGapAtr: 0.10 });
  assert(r3 && r3.dir === null,
    'a shelf whose formation includes the last bar does NOT fire — the imbalance has not resolved yet');
  /* a tape where the last bar sits INSIDE the shelf fires nothing (needs
     reclaim, not retest). Reuse the sameBar fixture and add bars that keep
     price INSIDE the shelf — no reclaim close above or below. */
  function craftInsideShelf(){
    const rows = craftSameBarShelf();
    const n = rows.length;
    /* add 3 bars holding above the shelf, then a last bar closing INSIDE the
       shelf (between the shelf top and bottom) — a retest, not a reclaim. */
    rows.push({t:(n)*900, o:2401, h:2402, l:2400, c:2401});
    rows.push({t:(n+1)*900, o:2401, h:2402, l:2400, c:2401});
    rows.push({t:(n+2)*900, o:2401, h:2402, l:2400, c:2401});
    rows.push({t:(n+3)*900, o:2401, h:2402, l:2394, c:2395.5});
    return rows;
  }
  const inside = craftInsideShelf();
  const r4 = W.pineGoldBpr(inside, { lookback: 20, minGapAtr: 0.10 });
  assert(r4 && r4.dir === null,
    'a last bar that closed inside the shelf fires NO signal — needs a reclaim close back above or below, not a retest');
}

/* ====================================================================
   § 5 pineGoldLayerStates reads BPR
   ==================================================================== */
console.log('== 5) pineGoldLayerStates reads BPR as a three-state mark ==');
{
  const W = loadModules(BASE);
  /* pineGoldLayerStates requires 60+ bars (pgrLayerStates line 1601). Warm
     up 60 flat bars, then one bull FVG and one bear FVG that overlap, then
     3 bars holding well above the shelf top so the state reads LONG. */
  function craftAboveShelf(){
    const rows = [];
    for (let i = 0; i < 60; i++) rows.push({t:i*900, o:2400, h:2400.5, l:2399.5, c:2400});
    /* bear impulse: FVG at barIndex 61 */
    rows.push({t:60*900, o:2400, h:2402, l:2398, c:2400});
    rows.push({t:61*900, o:2400, h:2401, l:2390, c:2391});
    rows.push({t:62*900, o:2391, h:2392, l:2390, c:2391});
    rows.push({t:63*900, o:2391, h:2392, l:2390, c:2391});
    /* bull impulse: FVG at barIndex 64 */
    rows.push({t:64*900, o:2391, h:2402, l:2390, c:2401});
    rows.push({t:65*900, o:2401, h:2402, l:2400, c:2401});
    /* 3 bars holding well above the shelf top ~2398 */
    rows.push({t:66*900, o:2415, h:2416, l:2414, c:2415});
    rows.push({t:67*900, o:2415, h:2416, l:2414, c:2415});
    rows.push({t:68*900, o:2415, h:2416, l:2414, c:2415});
    return rows;
  }
  const upTape = craftAboveShelf();
  const st = W.pineGoldLayerStates(upTape);
  assert(st.ok === true, 'the state read ran ok on a tape that forms a shelf (' + st.ok + ')');
  assert(st.bpr === 'long', 'the state reads LONG when close sits above the shelf top (' + st.bpr + ')');
  /* with no shelves the state reads NEITHER, never 'long' */
  const flat = Array.from({length: 80}, (_, i) => ({t:i*900, o:2400, h:2400, l:2400, c:2400}));
  const stF = W.pineGoldLayerStates(flat);
  assert(stF.bpr === null, 'a tape that forms no shelf reads NEITHER (not long, not short) — hg-v989 three-state');
}

/* ====================================================================
   § 6 the ranker and the gate modules read no BPR mark
   ==================================================================== */
console.log('== 6) no gate names pine:bprWith, no threshold moves ==');
{
  const names = ['goldind.js', 'goldscalp.js', 'goldswing.js', 'omnigold.js', 'ganeshgold.js', 'goldpine.js', 'eightypercent.js', 'plans.js'];
  for (const f of names){
    const src = readFileSync(f, 'utf8');
    assert(src.indexOf("pine:bprWith") < 0, f + ' names no pine:bprWith mark (textual, hg-v956)');
  }
}

/* ====================================================================
   § 7 ship stamps
   ==================================================================== */
console.log('== 7) build stamps say hg-v1282 ==');
{
  const bs = readFileSync('build-stamp.js', 'utf8');
  assert(/version:\s*'hg-v1282'/.test(bs), 'build-stamp.js version is hg-v1282');
  const sw = readFileSync('sw.js', 'utf8');
  assert(/HG_CACHE\s*=\s*'hg-v1282'/.test(sw), 'sw.js HG_CACHE is hg-v1282');
  const tt = readFileSync('trendtable.js', 'utf8');
  assert(/hg-v1282/.test(tt), 'trendtable.js header reads hg-v1282');
}

console.log('\nhg-v1203 BPR: all § passed');
